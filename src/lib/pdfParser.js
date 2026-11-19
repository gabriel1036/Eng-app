// Coordinate-aware parser for the 60-topic Vietnamese-English vocabulary PDF.
// The core (`parseDocumentItems`) is pure so it can run in Node tests and in the browser.
import { cleanIpa, cleanWord, normalizePos } from './normalize.js';

const HEADING_RE = /^(\d+)\.\s+Từ vựng về\s+(.+?)\s*$/;
const HEADER_WORDS = new Set(['từ vựng', 'từ loại', 'phiên âm', 'ý nghĩa']);
const COLS = ['word', 'pos', 'ipa', 'meaning'];
const FIRST_CONTENT_PAGE = 4; // pages 1-3 are cover + table of contents
const FOOTER_Y = 65; // standalone page numbers live below this

/** Convert a pdfjs textContent.items array into plain {x,y,w,str} records. */
export function toRawItems(items) {
  const out = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    out.push({ x: it.transform[4], y: it.transform[5], w: it.width || 0, str: it.str });
  }
  return out;
}

/** Group items sharing a baseline into visual lines (sorted left→right). */
function groupLines(items, tol = 3) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

function joinItems(items) {
  let s = '';
  let prevEnd = null;
  for (const it of items) {
    if (prevEnd !== null && it.x - prevEnd > 1.2 && !/^\s/.test(it.str) && !/\s$/.test(s)) s += ' ';
    s += it.str;
    prevEnd = it.x + it.w;
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Detect column left edges from the header row, fall back to defaults seen in the PDF. */
function detectColumnEdges(items) {
  const edges = {};
  for (const it of items) {
    const k = it.str.trim().toLowerCase();
    if (HEADER_WORDS.has(k)) edges[k] = it.x;
  }
  const xs = [edges['từ vựng'], edges['từ loại'], edges['phiên âm'], edges['ý nghĩa']];
  return xs.every((x) => typeof x === 'number') ? xs : [77.3, 194.3, 311.3, 428.3];
}

function columnOf(x, edges) {
  // boundaries sit slightly left of each column start to tolerate jitter
  for (let i = 3; i > 0; i--) if (x >= edges[i] - 12) return i;
  return 0;
}

/**
 * Turn one column's lines into cells. Lines closer than `wrapGap` belong to the same
 * (wrapped) cell. Returns [{y (centre), text}] top→bottom.
 */
function buildCells(lines, wrapGap) {
  const cells = [];
  for (const l of lines) {
    const text = joinItems(l.items);
    if (!text) continue;
    const last = cells[cells.length - 1];
    if (last && last.lastY - l.y <= wrapGap) {
      last.parts.push(text);
      last.ys.push(l.y);
      last.lastY = l.y;
    } else {
      cells.push({ parts: [text], ys: [l.y], lastY: l.y });
    }
  }
  return cells.map((c) => ({
    y: c.ys.reduce((a, b) => a + b, 0) / c.ys.length,
    topY: c.ys[0],
    text: c.parts.join(' ').replace(/\s+/g, ' ').trim(),
  }));
}

/**
 * Parse all pages.
 * @param {{pageNumber:number, items:{x,y,w,str}[]}[]} pages
 * @returns {{topics:{id,title}[], rows:object[], warnings:string[]}}
 */
export function parseDocumentItems(pages, opts = {}) {
  const wrapGap = opts.wrapGap ?? 17;
  const topics = [];
  const warnings = [];
  const rows = [];
  let current = null; // { topic, segments: [{page, cols:{word:[],pos:[],ipa:[],meaning:[]}}] }
  const sections = [];

  for (const page of pages) {
    if (page.pageNumber < FIRST_CONTENT_PAGE) continue;
    const edges = detectColumnEdges(page.items);
    const body = page.items.filter((it) => it.y > FOOTER_Y);

    // 1. headings (full-line match). Heading Y is used to split the page into segments.
    const lines = groupLines(body);
    const headings = [];
    for (const l of lines) {
      const text = joinItems(l.items);
      const m = text.match(HEADING_RE);
      if (m && l.items[0].x < edges[0]) headings.push({ y: l.y, id: +m[1], title: m[2], text });
    }
    headings.sort((a, b) => b.y - a.y);
    // Edge case: heading rendered slightly BELOW the first rows of its section. The table
    // header row ("Từ vựng | Từ loại | …") normally sits right under a heading; if one sits
    // just ABOVE the heading, the section really starts at that header row.
    const headerYs = body.filter((it) => it.str.trim().toLowerCase() === 'từ vựng').map((it) => it.y);
    for (const h of headings) {
      const above = headerYs.filter((y) => y > h.y + 3 && y - h.y < 80);
      h.splitY = above.length ? Math.max(...above) + 3 : h.y;
    }
    const headingY = new Set(headings.map((h) => h.y));

    // 2. content items (drop headings, repeated table headers, bare numbers lone in margins)
    const content = body.filter((it) => {
      if (headingY.has(it.y) && it.x < edges[0] - 0.5) return false;
      if (HEADER_WORDS.has(it.str.trim().toLowerCase())) return false;
      return true;
    });

    // 3. split page into bands: [top → heading1), [heading1 → heading2) ...
    const bands = [];
    const bounds = [Infinity, ...headings.map((h) => h.splitY), -Infinity];
    for (let i = 0; i < bounds.length - 1; i++) {
      const hi = bounds[i];
      const lo = bounds[i + 1];
      const its = content.filter((it) => it.y < hi && it.y > lo);
      const topic = i === 0 ? (current ? current.topic : null) : headings[i - 1];
      bands.push({ topic, items: its, newHeading: i > 0 ? headings[i - 1] : null });
    }

    // Edge case: a heading rendered slightly BELOW the first rows of its section.
    // If a heading exists and the band above it (i=0) holds rows that belong to the new
    // topic (i.e. there is no current topic yet), attach them to the heading.
    for (const b of bands) {
      if (b.newHeading) {
        current = { topic: { id: b.newHeading.id, title: b.newHeading.title }, segments: [] };
        sections.push(current);
        topics.push({ id: b.newHeading.id, title: b.newHeading.title });
      }
      if (!b.items.length) continue;
      if (!current) {
        warnings.push(`p${page.pageNumber}: content before first topic heading ignored`);
        continue;
      }
      const cols = { word: [], pos: [], ipa: [], meaning: [] };
      const byCol = [[], [], [], []];
      for (const it of b.items) byCol[columnOf(it.x, edges)].push(it);
      COLS.forEach((name, i) => {
        cols[name] = buildCells(groupLines(byCol[i]), wrapGap);
      });
      current.segments.push({ page: page.pageNumber, cols });
    }
  }

  for (const sec of sections) {
    for (const seg of sec.segments) {
      const { rows: segRows, warn } = alignSegment(seg);
      if (warn) warnings.push(`topic ${sec.topic.id} p${seg.page}: ${warn}`);
      for (const r of segRows) rows.push({ ...r, topicId: sec.topic.id, page: seg.page });
    }
  }

  return { topics, rows: rows.map(finishRow), warnings };
}

/** Align the 4 column cell-lists of a segment into rows. */
function alignSegment({ cols }) {
  const n = cols.word.length;
  const counts = COLS.map((c) => cols[c].length);
  const allEqual = counts.every((c) => c === n);

  // Stacked-block zipper (also the normal case): N words ↔ N pos ↔ N ipa ↔ N meanings.
  if (allEqual && n > 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        word: cols.word[i].text,
        pos: cols.pos[i].text,
        ipa: cols.ipa[i].text,
        meaning: cols.meaning[i].text,
        y: cols.word[i].y,
        suspect: maxYDelta(cols, i) > 40,
      });
    }
    return { rows: out };
  }

  // Fallback: anchor on the word column, assign other cells to the nearest word by Y.
  if (n === 0) {
    return { rows: [], warn: counts.some((c) => c) ? `orphan cells ${counts.join('/')}` : undefined };
  }
  const out = cols.word.map((w) => ({ word: w.text, pos: [], ipa: [], meaning: [], y: w.y, suspect: true }));
  for (const name of ['pos', 'ipa', 'meaning']) {
    for (const c of cols[name]) {
      let best = 0;
      for (let i = 1; i < n; i++) if (Math.abs(cols.word[i].y - c.y) < Math.abs(cols.word[best].y - c.y)) best = i;
      out[best][name].push(c.text);
    }
  }
  for (const r of out) {
    r.pos = r.pos.join(' ');
    r.ipa = r.ipa.join(' ');
    r.meaning = r.meaning.join(' ');
  }
  return { rows: out, warn: `column counts ${counts.join('/')} (word/pos/ipa/meaning) — Y-aligned fallback` };
}

function maxYDelta(cols, i) {
  const ys = COLS.map((c) => cols[c][i].y);
  return Math.max(...ys) - Math.min(...ys);
}

function finishRow(r) {
  const word = cleanWord(r.word);
  const issues = [];
  if (!r.pos) issues.push('no-pos');
  if (!r.ipa) issues.push('no-ipa');
  if (!r.meaning) issues.push('no-meaning');
  if (r.suspect) issues.push('misaligned?');
  return {
    topicId: r.topicId,
    page: r.page,
    word,
    pos: normalizePos(r.pos),
    ipa: cleanIpa(r.ipa),
    meaning: r.meaning.replace(/\s+/g, ' ').trim(),
    issues,
  };
}

/** Browser/Node PDF driver. `pdfjs` is the imported pdfjs-dist module. */
export async function parsePdfData(pdfjs, data, onProgress) {
  const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (p >= FIRST_CONTENT_PAGE) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      pages.push({ pageNumber: p, items: toRawItems(tc.items) });
    }
    onProgress?.(p, pdf.numPages);
  }
  return parseDocumentItems(pages);
}
