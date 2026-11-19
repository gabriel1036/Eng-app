import Dexie from 'dexie';
import dexieCloud from 'dexie-cloud-addon';

/**
 * Cloud sync (Dexie Cloud) is opt-in: it is enabled only when VITE_DEXIE_CLOUD_URL is set at
 * build time. Without it the app is purely local, exactly as before.
 *
 * Dexie Cloud needs client-generated STRING primary keys (no ++auto-increment) and does not
 * support unique secondary indexes, so words/reviews use `id` strings and `key` is a plain index
 * (de-duplication by key is done in code: see mergeRows / dedupeByKey).
 */
export const CLOUD_URL = import.meta.env.VITE_DEXIE_CLOUD_URL || '';
export const cloudEnabled = !!CLOUD_URL;

export const db = new Dexie('vocab-memory-v2', { addons: cloudEnabled ? [dexieCloud] : [] });

db.version(1).stores({
  words: 'id, key, *topicIds, pos, nextReview, lastReview, enrichStatus, order',
  reviews: 'id, wordId, ts, day',
  topics: 'id', // static (re-created from seed.json) → not synced
  enrichCache: 'term', // local API cache → not synced
  meta: 'key', // local flags → not synced
});

if (cloudEnabled) {
  db.cloud.configure({
    databaseUrl: CLOUD_URL,
    requireAuth: false, // works offline/anonymous; sign in to start syncing
    unsyncedTables: ['topics', 'enrichCache', 'meta'],
  });
}

export const newId = (prefix) => `${prefix}${crypto.randomUUID().replace(/-/g, '')}`;

export const DAY = 86_400_000;

export function newSrsFields() {
  return { easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: 0, lastReview: 0, lapses: 0 };
}

export function statusOf(w) {
  if (!w.lastReview) return 'new';
  if (w.interval >= 21) return 'mastered';
  return 'learning';
}

export const isDue = (w, now = Date.now()) => w.lastReview > 0 && w.nextReview <= now;

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Best IPA to show: clean API IPA first, PDF IPA as fallback (multi-word phrases). */
export const displayIpa = (w) => w.apiIpa || w.ipa || '';

// ---------- backup ----------
export async function exportBackup() {
  const [words, topics, reviews, enrichCache] = await Promise.all([
    db.words.toArray(),
    db.topics.toArray(),
    db.reviews.toArray(),
    db.enrichCache.toArray(),
  ]);
  return { app: 'vocab-memory', version: 1, exportedAt: new Date().toISOString(), words, topics, reviews, enrichCache };
}

export async function importBackup(json, { replace = true } = {}) {
  if (!json || json.app !== 'vocab-memory' || !Array.isArray(json.words)) throw new Error('Not a Vocab Memory backup file');
  // Backups from the first (numeric id) version are accepted too: ids are regenerated and
  // review rows are re-pointed to the new word ids.
  const idMap = new Map();
  const incoming = json.words.map((w) => {
    const id = typeof w.id === 'string' ? w.id : newId('wrd');
    idMap.set(w.id, id);
    return { ...w, id };
  });
  const reviews = (json.reviews || []).map((r) => ({ ...r, id: typeof r.id === 'string' ? r.id : newId('rev'), wordId: idMap.get(r.wordId) ?? r.wordId }));

  await db.transaction('rw', db.words, db.topics, db.reviews, db.enrichCache, async () => {
    if (replace) await Promise.all([db.words.clear(), db.topics.clear(), db.reviews.clear(), db.enrichCache.clear()]);
    await db.topics.bulkPut(json.topics || []);
    await db.enrichCache.bulkPut(json.enrichCache || []);
    if (replace) {
      await db.words.bulkPut(incoming);
      await db.reviews.bulkPut(reviews);
    } else {
      const existing = new Map((await db.words.toArray()).map((w) => [w.key, w]));
      const remap = new Map();
      for (const w of incoming) {
        const cur = existing.get(w.key);
        if (!cur) {
          await db.words.add(w);
          remap.set(w.id, w.id);
        } else {
          remap.set(w.id, cur.id);
          const newer = (w.lastReview || 0) > (cur.lastReview || 0);
          const { id, ...rest } = w;
          await db.words.update(cur.id, {
            ...(newer ? rest : {}),
            topicIds: [...new Set([...cur.topicIds, ...w.topicIds])],
            userSentences: dedupeSentences([...(cur.userSentences || []), ...(w.userSentences || [])]),
          });
        }
      }
      await db.reviews.bulkPut(reviews.map((r) => ({ ...r, wordId: remap.get(r.wordId) ?? r.wordId })));
    }
  });
}

function dedupeSentences(list) {
  const seen = new Set();
  return list.filter((s) => !seen.has(s.text) && seen.add(s.text));
}


// ---------- housekeeping ----------

/**
 * Two devices that seeded/imported independently end up with two cards for the same
 * (word + pos) once they sync. Collapse them: keep the most-studied card, merge topics,
 * sentences and enrichment, re-point review logs, delete the rest.
 */
export async function dedupeByKey() {
  const all = await db.words.toArray();
  const groups = new Map();
  for (const w of all) groups.set(w.key, [...(groups.get(w.key) || []), w]);
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (b.lastReview || 0) - (a.lastReview || 0) || (b.repetitions || 0) - (a.repetitions || 0) || a.id.localeCompare(b.id));
    const [keep, ...rest] = list;
    const patch = {
      topicIds: [...new Set(list.flatMap((w) => w.topicIds))],
      userSentences: dedupeSentences(list.flatMap((w) => w.userSentences || [])),
    };
    for (const w of rest) {
      if (keep.enrichStatus !== 'done' && w.enrichStatus === 'done') Object.assign(patch, pickEnrichment(w));
    }
    await db.transaction('rw', db.words, db.reviews, async () => {
      await db.words.update(keep.id, patch);
      for (const w of rest) {
        await db.reviews.where('wordId').equals(w.id).modify({ wordId: keep.id });
        await db.words.delete(w.id);
        removed++;
      }
    });
  }
  return removed;
}

const pickEnrichment = (w) => ({
  apiIpa: w.apiIpa, audioUs: w.audioUs, audioUk: w.audioUk, definition: w.definition, examples: w.examples, enrichStatus: w.enrichStatus, enrichedAt: w.enrichedAt,
});

/** One-time copy of data from the first release (database "vocab-memory", numeric ids). */
export async function migrateFromV1() {
  if (await db.meta.get('migratedFromV1')) return 0;
  // belt and braces against concurrent callers: claim the flag inside a transaction
  const claimed = await db.transaction('rw', db.meta, async () => {
    if (await db.meta.get('migrating')) return false;
    await db.meta.put({ key: 'migrating', value: Date.now() });
    return true;
  });
  if (!claimed) return 0;
  if (!(await Dexie.exists('vocab-memory'))) return 0;
  const old = new Dexie('vocab-memory');
  let moved = 0;
  try {
    await old.open(); // opens with its existing schema, no declaration needed
    const [words, topics, reviews] = await Promise.all([
      old.table('words').toArray(),
      old.table('topics').toArray(),
      old.table('reviews').toArray(),
    ]);
    if (!(await db.words.count()) && words.length) {
      const idMap = new Map();
      const nw = words.map((w) => {
        const id = newId('wrd');
        idMap.set(w.id, id);
        return { ...w, id };
      });
      await db.transaction('rw', db.words, db.topics, db.reviews, async () => {
        await db.topics.bulkPut(topics);
        await db.words.bulkAdd(nw);
        await db.reviews.bulkAdd(reviews.map((r) => ({ ...r, id: newId('rev'), wordId: idMap.get(r.wordId) })).filter((r) => r.wordId));
      });
      moved = nw.length;
    }
  } catch (e) {
    console.warn('V1 migration failed, will retry next start:', e);
    await db.meta.delete('migrating');
    return 0;
  } finally {
    old.close();
  }
  await db.meta.put({ key: 'migratedFromV1', value: Date.now() });
  return moved;
}
