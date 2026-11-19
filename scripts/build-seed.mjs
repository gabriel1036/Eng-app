// Parses sample/vocab.pdf with the same coordinate-aware parser used in the browser
// and writes public/seed.json (a convenience for "Load pre-parsed data").
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { parsePdfData } from '../src/lib/pdfParser.js';

const src = process.argv[2] || 'sample/vocab.pdf';
const r = await parsePdfData(pdfjs, new Uint8Array(fs.readFileSync(src)));
fs.writeFileSync('public/seed.json', JSON.stringify({ topics: r.topics, rows: r.rows }));
console.log('topics', r.topics.length, 'rows', r.rows.length, 'warnings', r.warnings.length);
r.warnings.forEach((w) => console.log(' !', w));
