const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex matching the target word (with common inflections) or exact multi-word phrase. */
export function wordRegex(word) {
  const w = word.trim().replace(/\s+/g, ' ');
  if (/\s/.test(w)) return new RegExp(`\\b${w.split(' ').map(esc).join('\\s+')}\\b`, 'i');
  const stem = /[^aeiou]y$/i.test(w) ? esc(w.slice(0, -1)) : null;
  const base = esc(w);
  const variants = `${base}(?:s|es|ed|d|ing|er|ers|ly|al)?` + (stem ? `|${stem}(?:ies|ied|ier|ily)` : '');
  const doubled = /[^aeiou][aeiou][^aeiouwxy]$/i.test(w) ? `|${base}${esc(w.slice(-1))}(?:ed|ing|er)` : '';
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${variants}${doubled})(?![\\p{L}\\p{N}])`, 'iu');
}

/** → {before, answer, after} or null if the sentence does not contain the word. */
export function makeCloze(sentence, word) {
  if (!sentence || !word) return null;
  let m;
  try {
    m = wordRegex(word).exec(sentence);
  } catch {
    return null;
  }
  if (!m) return null;
  return { before: sentence.slice(0, m.index), answer: m[0], after: sentence.slice(m.index + m[0].length) };
}

// Sentences with spelling-variant notes like "(BrE: pencilled)" would leak the answer.
const noisy = (s) => /\((?:BrE|AmE|US|UK)\b/i.test(s) || (s.match(/_{2,}/g) || []).length > 0;
export const hasWord = (sentence, word) => !noisy(sentence) && !!makeCloze(sentence, word);

/** Pick the best usable example (user sentences first when they contain the word). */
export function pickExample(word) {
  const pool = [
    ...(word.userSentences || []).map((s) => s.text),
    ...(word.examples || []),
  ].filter((s) => hasWord(s, word.word));
  if (!pool.length) return null;
  const api = (word.examples || []).filter((s) => hasWord(s, word.word));
  const list = api.length ? api : pool;
  return list[Math.floor(Math.random() * list.length)];
}
