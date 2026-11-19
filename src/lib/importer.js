import { db, newSrsFields, newId } from './db.js';
import { makeKey, cleanWord, normalizePos, cleanIpa } from './normalize.js';

/**
 * Merge parsed rows into the library. Deduplicates by (normalizedWord + normalizedPos):
 * the same word in several topics becomes ONE card carrying every topic id.
 * Existing SRS state, enrichment and user sentences are never overwritten.
 */
export async function mergeRows(rows, topics) {
  let added = 0;
  let merged = 0;
  await db.transaction('rw', db.words, db.topics, async () => {
    await db.topics.bulkPut(topics.map((t) => ({ id: t.id, title: t.title })));
    const existing = new Map((await db.words.toArray()).map((w) => [w.key, w]));
    let order = (await db.words.orderBy('order').last())?.order ?? -1;
    const toAdd = [];
    const inBatch = new Set(); // records created during this call (not in the DB yet)
    const toUpdate = new Map();

    for (const r of rows) {
      const word = cleanWord(r.word);
      if (!word) continue;
      const pos = normalizePos(r.pos);
      const key = makeKey(word, pos);
      const hit = existing.get(key);
      if (hit) {
        // `hit` may be a record added earlier in THIS batch (no id yet) — mutate it directly.
        const target = inBatch.has(hit) ? hit : toUpdate.get(hit.id) || { id: hit.id, topicIds: [...hit.topicIds] };
        if (!target.topicIds.includes(r.topicId)) target.topicIds.push(r.topicId);
        const curMeaning = target.meaning ?? hit.meaning ?? '';
        if (!curMeaning && r.meaning) target.meaning = r.meaning;
        else if (r.meaning && curMeaning !== r.meaning && !curMeaning.split(/\s*;\s*/).includes(r.meaning))
          target.meaning = `${curMeaning}; ${r.meaning}`;
        if (!(target.ipa ?? hit.ipa) && r.ipa) target.ipa = cleanIpa(r.ipa);
        if (!inBatch.has(hit)) {
          toUpdate.set(hit.id, target);
          hit.topicIds = target.topicIds;
          hit.meaning = target.meaning ?? hit.meaning;
        }
        merged++;
      } else {
        const rec = {
          id: newId('wrd'),
          key,
          word,
          pos,
          ipa: cleanIpa(r.ipa),
          meaning: r.meaning || '',
          topicIds: [r.topicId],
          order: ++order,
          apiIpa: '',
          audioUs: '',
          audioUk: '',
          definition: '',
          examples: [],
          enrichStatus: 'none',
          userSentences: [],
          createdAt: Date.now(),
          ...newSrsFields(),
        };
        existing.set(key, rec);
        inBatch.add(rec);
        toAdd.push(rec);
        added++;
      }
    }
    if (toAdd.length) await db.words.bulkAdd(toAdd);
    for (const p of toUpdate.values()) {
      const { id, ...rest } = p;
      await db.words.update(id, rest);
    }
  });
  return { added, merged };
}

export async function loadSeed() {
  const res = await fetch(`${import.meta.env.BASE_URL}seed.json`);
  if (!res.ok) throw new Error('seed.json not found — run: node scripts/build-seed.mjs');
  const { topics, rows } = await res.json();
  return mergeRows(rows, topics);
}

export async function wipeAll() {
  await Promise.all([db.words.clear(), db.topics.clear(), db.reviews.clear(), db.enrichCache.clear()]);
  await db.meta.put({ key: 'seeded', value: Date.now() }); // don't re-seed after an explicit clear
}

/** Topic titles are static: (re)create them from the bundled seed if this device has none. */
export async function ensureTopics() {
  const have = await db.topics.count();
  const needed = Math.max(0, ...(await db.words.toArray()).flatMap((w) => w.topicIds));
  if (have && have >= needed) return;
  const res = await fetch(`${import.meta.env.BASE_URL}seed.json`);
  if (res.ok) await db.topics.bulkPut((await res.json()).topics.map((t) => ({ id: t.id, title: t.title })));
}

/** Load the bundled sample once, only into an empty library. */
export async function seedIfFirstRun() {
  if ((await db.meta.get('seeded')) || (await db.words.count())) return null;
  const r = await loadSeed();
  await db.meta.put({ key: 'seeded', value: Date.now() });
  return r;
}
