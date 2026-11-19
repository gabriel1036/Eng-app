# Vocab Memory

Client-side vocabulary trainer for the 60-topic Vietnamese–English PDF (Từ vựng | Từ loại | Phiên âm | Ý nghĩa).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # SM-2, cloze, diff, parser (incl. sample/vocab.pdf if present)
npm run seed     # re-generate public/seed.json from sample/vocab.pdf
npm run build
```

**First run:** Import → drop the PDF (parsed in-browser from X/Y coordinates), review/edit the preview table, then *Import*.
"Load pre-parsed Oxford 3000 data" loads the same result from `public/seed.json`.

| Area | Where |
|---|---|
| Coordinate-aware PDF parser, topic segmentation, column zipper | `src/lib/pdfParser.js` |
| POS / IPA / ligature cleanup, dedupe key | `src/lib/normalize.js` |
| Dexie schema, backup export/import | `src/lib/db.js` |
| SM-2 (Again <1m · Hard 12h · Good 1d · Easy 4d) | `src/lib/srs.js` |
| Rate-limited dictionary enrichment (2 req/s, cached) | `src/lib/enrich.js` |
| Cloze / dictation / quiz cards | `src/components/*Card.jsx` |

Shortcuts: `Space` flip · `1`–`4` rate (or choose quiz option) · `R` replay, `Shift+R` other speed (`Alt+R` while typing).

## Install as an app (PWA)

`npm run build` produces `dist/` with a manifest and a service worker (offline-capable). Host `dist/` on any static host
(Cloudflare Pages, Netlify, Vercel…) over HTTPS, open the URL on each device and use *Add to Home Screen / Install*.

## Sync across devices (Dexie Cloud, opt-in)

Without configuration the app is local-only. To enable sync:

1. Create a cloud database (needs your email — you do this once):
   ```bash
   npx dexie-cloud create          # writes dexie-cloud.json + dexie-cloud.key (keep the key private)
   npx dexie-cloud whitelist http://localhost:5173
   npx dexie-cloud whitelist https://<your-deployed-origin>
   ```
   (Command names are from memory of the Dexie Cloud CLI — run `npx dexie-cloud --help` / see https://dexie.org/cloud/ to confirm,
   and check their current pricing/limits.)
2. Put the database URL in the build environment:
   ```bash
   cp .env.example .env.local     # VITE_DEXIE_CLOUD_URL=https://<id>.dexie.cloud
   ```
   On a host (Netlify/Vercel/Cloudflare) set the same variable in the project settings, then rebuild.
3. Open the app → **Sign in to sync** (email one-time code). Repeat on every device with the same email.

What syncs: `words` (cards, SRS state, sentences, enrichment) and `reviews`. Local-only: `topics` (rebuilt from `seed.json`),
`enrichCache`, `meta`, and UI settings (`localStorage`).
A device that signs in never seeds the sample data until it has pulled the cloud library; afterwards duplicate cards
(same word + POS created on two devices) are merged automatically (`dedupeByKey`).

Data from the first release (database `vocab-memory`, numeric ids) is copied once into `vocab-memory-v2` on first start
(old database is left untouched). Backups from the first release can still be imported.

## Deploy to Cloudflare Pages

**Option 1 — Git integration (recommended):** Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
Framework preset *None*; build command `npm run build`; output directory `dist`; environment variables:
`NODE_VERSION=20` and (for sync) `VITE_DEXIE_CLOUD_URL=https://<id>.dexie.cloud`.
Then `npx dexie-cloud whitelist https://<project>.pages.dev`.

**Option 2 — CLI:** `npx wrangler login` once, then `VITE_DEXIE_CLOUD_URL=https://<id>.dexie.cloud npm run deploy`
(the first run creates the Pages project `vocab-memory`; change the name in `wrangler.toml` and `package.json` if taken).

`public/_headers` sets cache rules (service worker and manifest are always revalidated, hashed assets are immutable).
`dexie-cloud.key` and `.env.local` are git-ignored — never upload them.
