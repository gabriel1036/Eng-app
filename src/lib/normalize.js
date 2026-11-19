// Normalisation helpers shared by parser, enrichment and UI.

const POS_MAP = {
  n: 'n', noun: 'n',
  v: 'v', verb: 'v',
  adj: 'adj', a: 'adj', adjective: 'adj',
  adv: 'adv', adverb: 'adv',
  prep: 'prep', preposition: 'prep',
  pron: 'pron', pronoun: 'pron',
  conj: 'conj', conjunction: 'conj',
  det: 'det', determiner: 'det',
  interj: 'interj', exclamation: 'interj', exclam: 'interj',
  num: 'num', numeral: 'num',
  art: 'art', article: 'art',
  pre: 'prep',
  abbr: 'abbr',
  idiom: 'idiom',
};

export function normalizePos(raw) {
  if (!raw) return '';
  let s = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  s = s.replace(/\s*\.\s*/g, '. ').replace(/\.\s*$/, '').trim();
  s = s.replace(/\s*,\s*/g, ', ');
  // "phrasal v", "phrasal verb"
  if (/^phrasal\s*v(erb)?$/.test(s)) return 'phrasal v';
  const m = s.match(/^([a-z]+)\.?\s*phr(ase)?$/);
  if (m) return `${POS_MAP[m[1]] || m[1]}. phr`;
  if (s.includes(',') || s.includes('/')) {
    return s.split(/\s*[,/]\s*/).map((p) => POS_MAP[p.replace(/\./g, '')] || p).join(', ');
  }
  return POS_MAP[s.replace(/\./g, '')] || s;
}

const IPA_FIXES = [
  [/ช/g, 'ʊ'],
  [/ǝ/g, 'ə'],
  [/ı/g, 'ɪ'],
  [/ɚ/g, 'ər'],
  [/ʤ/g, 'dʒ'],
  [/ʧ/g, 'tʃ'],
  [/Λ/g, 'ʌ'],
  [/∫/g, 'ʃ'],
  [/ɳ/g, 'ŋ'],
  [/ʳ/g, 'r'],
  [/[‘’']\s*/g, 'ˈ'],
  [/:/g, 'ː'],
  [/,/g, 'ˌ'],
  [/[A-Z]/g, (m) => m.toLowerCase()],
  [/ /g, ' '],
  [/\s+/g, ' '],
];

export function cleanIpa(raw) {
  if (!raw) return '';
  let s = raw.replace(/\u0000/g, 'fi');
  for (const [re, rep] of IPA_FIXES) s = s.replace(re, rep);
  s = s.trim();
  // Make sure it is wrapped in slashes if it looks like IPA
  s = s.replace(/^\/\s*/, '/').replace(/\s*\/$/, '/');
  return s;
}

export function normalizeWord(w) {
  return (w || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
}

// The PDF font drops ligature glyphs (fi/ff/fl/ffi/ffl) and emits U+0000 instead.
// Infer which ligature from the neighbouring letters.
export function fixLigatures(w) {
  return (w || '').replace(/\u0000/g, (_m, off, str) => {
    const prev = (str[off - 1] || '').toLowerCase();
    const next = str.slice(off + 1).toLowerCase();
    if (next === '' || next[0] === ' ') return 'ff';
    if (/^le(\s|$)/.test(next)) return 'ff';
    if (prev === 'o' && next[0] === 's') return 'ff';
    if (next[0] === 'c') return /[oa]/.test(prev) ? 'ffi' : 'fi';
    if (/^[ae]/.test(next)) return /[auo]/.test(prev) ? 'ff' : 'fi';
    return 'fi';
  });
}

export function cleanWord(w) {
  return fixLigatures(w || '').replace(/\s+/g, ' ').trim();
}

export function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

export function makeKey(word, pos) {
  return `${normalizeWord(word)}|${normalizePos(pos)}`;
}
