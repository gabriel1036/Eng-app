// Lazy enrichment via the Free Dictionary API.
//  • single global queue, max 2 network requests / second
//  • every lookup (hits AND misses) is cached in IndexedDB → never fetched twice
//  • the active deck is pushed to the FRONT of the queue (prioritize)
//  • 429 → global back-off and retry
import { db } from './db.js';
import { hasWord } from './cloze.js';

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const MIN_GAP_MS = 500; // 2 req/s
const POS_NAMES = {
  n: 'noun', 'n. phr': 'noun', v: 'verb', 'v. phr': 'verb', 'phrasal v': 'verb', adj: 'adjective',
  adv: 'adverb', prep: 'preposition', pron: 'pronoun', conj: 'conjunction', interj: 'interjection',
};

const pending = new Map(); // id -> word (insertion order = priority)
const listeners = new Set();
let running = false;
let lastNetwork = 0;
let pausedUntil = 0;
let stats = { done: 0, failed: 0, active: false, paused: false };

const emit = () => listeners.forEach((fn) => fn(getEnrichState()));
export const getEnrichState = () => ({ ...stats, pending: pending.size });
export function subscribeEnrich(fn) {
  listeners.add(fn);
  fn(getEnrichState());
  return () => listeners.delete(fn);
}

/** Lookup term for a word, or null when the API can't know it (phrases, odd chars). */
export function lookupTerm(word) {
  const t = word.trim().toLowerCase();
  return /^[a-z][a-z'-]*$/.test(t) ? t : null;
}

export function enqueue(words, { front = false } = {}) {
  const todo = words.filter((w) => w && w.enrichStatus !== 'done' && w.enrichStatus !== 'missing');
  if (front) {
    const rest = [...pending.entries()].filter(([id]) => !todo.some((w) => w.id === id));
    pending.clear();
    todo.forEach((w) => pending.set(w.id, w));
    rest.forEach(([id, w]) => pending.set(id, w));
  } else todo.forEach((w) => !pending.has(w.id) && pending.set(w.id, w));
  emit();
  run();
}

export const prioritize = (words) => enqueue(words, { front: true });

export function clearQueue() {
  pending.clear();
  emit();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  if (running) return;
  running = true;
  stats.active = true;
  emit();
  try {
    while (pending.size) {
      const [id, w] = pending.entries().next().value;
      const term = lookupTerm(w.word);
      if (!term) {
        pending.delete(id);
        await db.words.update(id, { enrichStatus: 'missing', enrichedAt: Date.now() });
        stats.done++;
        emit();
        continue;
      }
      let entry = await db.enrichCache.get(term);
      if (!entry) {
        const wait = Math.max(pausedUntil, lastNetwork + MIN_GAP_MS) - Date.now();
        if (wait > 0) {
          stats.paused = pausedUntil > Date.now();
          emit();
          await sleep(wait);
          stats.paused = false;
        }
        lastNetwork = Date.now();
        const res = await fetchEntry(term);
        if (res.status === 'rate') {
          pausedUntil = Date.now() + 6000;
          continue; // keep item at the front, retry after back-off
        }
        if (res.status === 'error') {
          pending.delete(id);
          stats.failed++;
          pausedUntil = Date.now() + 2000;
          await db.words.update(id, { enrichStatus: 'error' });
          emit();
          continue;
        }
        entry = { term, found: res.status === 'ok', data: res.data || null, ts: Date.now() };
        await db.enrichCache.put(entry);
      }
      pending.delete(id);
      await applyEntry(w, entry);
      stats.done++;
      emit();
    }
  } finally {
    running = false;
    stats.active = false;
    emit();
  }
}

async function fetchEntry(term) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(API + encodeURIComponent(term), { signal: ctl.signal });
    if (r.status === 429) return { status: 'rate' };
    if (r.status === 404) return { status: 'missing' };
    if (!r.ok) return { status: 'error' };
    return { status: 'ok', data: await r.json() };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

/** Distil the raw API payload into the few fields we use. */
export function distill(data, word) {
  if (!Array.isArray(data)) return null;
  const phon = data.flatMap((e) => e.phonetics || []);
  const find = (re) => phon.find((p) => p.audio && re.test(p.audio));
  const us = find(/-us\.mp3/i);
  const uk = find(/-uk\.mp3/i);
  const ipaSrc =
    us?.text || phon.find((p) => p.text)?.text || data.find((e) => e.phonetic)?.phonetic || uk?.text || '';
  const posName = POS_NAMES[word.pos];
  const meanings = data.flatMap((e) => e.meanings || []);
  const ordered = [...meanings.filter((m) => m.partOfSpeech === posName), ...meanings.filter((m) => m.partOfSpeech !== posName)];
  const defs = ordered.flatMap((m) => m.definitions || []);
  const examples = [];
  for (const d of defs) {
    const ex = d.example?.trim();
    if (ex && ex.length <= 160 && hasWord(ex, word.word) && !examples.includes(ex)) examples.push(ex);
  }
  examples.sort((a, b) => a.length - b.length);
  return {
    apiIpa: ipaSrc ? ipaSrc.replace(/\s+/g, ' ').trim() : '',
    audioUs: us?.audio || '',
    audioUk: uk?.audio || '',
    definition: defs[0]?.definition || '',
    examples: examples.slice(0, 3),
  };
}

async function applyEntry(w, entry) {
  if (!entry.found) return db.words.update(w.id, { enrichStatus: 'missing', enrichedAt: Date.now() });
  const d = distill(entry.data, w);
  if (!d) return db.words.update(w.id, { enrichStatus: 'missing', enrichedAt: Date.now() });
  return db.words.update(w.id, { ...d, enrichStatus: 'done', enrichedAt: Date.now() });
}

/** Resolve when all given word ids are enriched (or settled) or after `ms`. */
export async function waitForEnrichment(ids, ms = 2500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ws = await db.words.bulkGet(ids);
    if (ws.every((w) => !w || w.enrichStatus !== 'none')) return;
    await sleep(150);
  }
}

/** Requeue words that errored out earlier (offline etc). */
export async function retryFailed() {
  const failed = await db.words.where('enrichStatus').equals('error').toArray();
  await Promise.all(failed.map((w) => db.words.update(w.id, { enrichStatus: 'none' })));
  enqueue(failed.map((w) => ({ ...w, enrichStatus: 'none' })));
}
