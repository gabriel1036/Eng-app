import { describe, it, expect } from 'vitest';
import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { schedule, formatInterval } from '../src/lib/srs.js';
import { makeCloze } from '../src/lib/cloze.js';
import { diffChars } from '../src/lib/diff.js';
import { cleanIpa, normalizePos, fixLigatures, makeKey } from '../src/lib/normalize.js';
import { parseDocumentItems, parsePdfData } from '../src/lib/pdfParser.js';
import { distill } from '../src/lib/enrich.js';

describe('SM-2', () => {
  const fresh = { easeFactor: 2.5, interval: 0, repetitions: 0, lapses: 0 };
  it('first-step intervals match button labels', () => {
    expect(formatInterval(schedule(fresh, 1).interval)).toBe('<1m');
    expect(schedule(fresh, 2).interval).toBe(0.5);
    expect(schedule(fresh, 3).interval).toBe(1);
    expect(schedule(fresh, 4).interval).toBe(4);
  });
  it('grows by ease factor and resets on lapse', () => {
    let c = { ...fresh, ...schedule(fresh, 3) };
    c = { ...c, ...schedule(c, 3) };
    expect(c.interval).toBe(6);
    c = { ...c, ...schedule(c, 3) };
    expect(c.interval).toBe(15);
    const l = schedule(c, 1);
    expect(l.repetitions).toBe(0);
    expect(l.lapses).toBe(1);
    expect(l.easeFactor).toBeCloseTo(2.3);
  });
  it('ease factor never drops below 1.3', () => {
    let c = fresh;
    for (let i = 0; i < 20; i++) c = { ...c, ...schedule(c, 1) };
    expect(c.easeFactor).toBe(1.3);
  });
});

describe('cloze', () => {
  it('blanks inflected words', () => {
    const c = makeCloze('She forgot her pencils at school.', 'pencil');
    expect(c.answer).toBe('pencils');
    expect(c.before + '_' + c.after).toBe('She forgot her _ at school.');
  });
  it('matches phrases and rejects absent words', () => {
    expect(makeCloze('Put the test  tube down.', 'Test Tube')).toBeTruthy();
    expect(makeCloze('A scatter of papers.', 'cat')).toBeNull();
  });
});

describe('diff + normalize', () => {
  it('marks wrong characters', () => {
    const d = diffChars('recieve', 'receive');
    expect(d.correct).toBe(false);
    expect(diffChars('Receive', 'receive').correct).toBe(true);
  });
  it('cleans IPA artefacts and POS', () => {
    expect(cleanIpa('/ˈbชk/')).toBe('/ˈbʊk/');
    expect(cleanIpa("/ʃeiv/ ‘ʤ")).toContain('dʒ');
    expect(normalizePos('N. phr')).toBe('n. phr');
    expect(normalizePos('V')).toBe('v');
    expect(normalizePos('pre')).toBe('prep');
    expect(normalizePos('Phrasal V')).toBe('phrasal v');
  });
  it('restores ligatures', () => {
    expect(fixLigatures('Co\0ee')).toBe('Coffee');
    expect(fixLigatures('Jelly\0sh')).toBe('Jellyfish');
    expect(fixLigatures('Tra\0c')).toBe('Traffic');
    expect(fixLigatures('Turn o\0')).toBe('Turn off');
  });
  it('dedup key ignores case/pos formatting', () => {
    expect(makeKey('Teacher ', 'N')).toBe(makeKey('teacher', 'n'));
  });
});

describe('API distillation', () => {
  it('extracts IPA, audio and in-sentence examples', () => {
    const d = distill(
      [{ phonetics: [{ text: '/bʊk/', audio: 'https://x/book-us.mp3' }], meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a thing', example: 'I read a book today.' }, { definition: 'x', example: 'Unrelated sentence.' }] }] }],
      { word: 'Book', pos: 'n' },
    );
    expect(d.apiIpa).toBe('/bʊk/');
    expect(d.audioUs).toContain('us.mp3');
    expect(d.examples).toEqual(['I read a book today.']);
  });
});

describe('table zipper (synthetic)', () => {
  const it_ = (x, y, str) => ({ x, y, w: str.length * 5, str });
  it('zips stacked column blocks 1-to-1 and handles heading below first rows', () => {
    const page = {
      pageNumber: 5,
      items: [
        it_(72, 704, '1. Từ vựng về thử nghiệm'),
        it_(77, 670, 'Apple'), it_(194, 670, 'n'), it_(311, 670, '/ˈæp.əl/'), it_(428, 670, 'Quả táo'),
        it_(77, 642, 'Big'), it_(77, 628, 'house'), it_(194, 635, 'n. phr'), it_(311, 635, '/bɪɡ haʊs/'), it_(428, 642, 'Ngôi nhà'), it_(428, 628, 'lớn'),
        it_(303, 51, '3'),
      ],
    };
    const r = parseDocumentItems([page]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]).toMatchObject({ word: 'Big house', pos: 'n. phr', meaning: 'Ngôi nhà lớn', topicId: 1 });
    expect(r.warnings).toHaveLength(0);
  });
});

const PDF = 'sample/vocab.pdf';
describe.skipIf(!fs.existsSync(PDF))('real PDF', () => {
  it('parses 60 topics with no structural issues', async () => {
    const r = await parsePdfData(pdfjs, new Uint8Array(fs.readFileSync(PDF)));
    expect(r.topics).toHaveLength(60);
    expect(r.rows.length).toBeGreaterThan(1700);
    expect(r.rows.filter((x) => x.issues.length)).toHaveLength(0);
    expect(r.rows.some((x) => x.word.includes('\0'))).toBe(false);
    expect(r.rows.some((x) => /[ช]/.test(x.ipa))).toBe(false);
  }, 60000);
});
