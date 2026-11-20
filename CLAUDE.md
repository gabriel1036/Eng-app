# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                          # Vite dev server, http://localhost:5173
npm run build                        # production build + PWA service worker into dist/
npm test                             # vitest run (node environment, tests/lib.test.js)
npx vitest run -t "<test name>"      # single test
npm run seed                         # regenerate public/seed.json from sample/vocab.pdf
npm run deploy                       # build + wrangler pages deploy (Cloudflare Pages, project eng-app)
```

No linter is configured. Node 20 (`.node-version`).

## Architecture

Fully client-side React 19 + Vite + Tailwind 3 app: a spaced-repetition trainer for the Oxford 3000 Vietnamese–English vocabulary PDF (60 topics, ~1,623 unique words). All persistence is IndexedDB via Dexie; there is no backend.

- **Data source:** `sample/vocab.pdf` is parsed by `src/lib/pdfParser.js` (coordinate-aware, using pdfjs-dist X/Y positions to rebuild the table columns and segment topics). The same parser runs in the browser (Import view) and in `scripts/build-seed.mjs`, which writes the bundled `public/seed.json`. `src/lib/normalize.js` cleans POS/IPA/ligatures and builds the dedupe `key` (word + POS). `src/lib/importer.js` merges rows into the DB, including merging duplicates within the same batch.
- **Boot flow (`src/lib/boot.js`):** single-flight (React StrictMode double-mounts effects) → `migrateFromV1` → `ensureTopics` → seed from `seed.json` on first run. In cloud builds seeding is deferred until the first sync has pulled the cloud library (`afterSync`), then `dedupeByKey` merges cards created on two devices.
- **DB (`src/lib/db.js`):** database `vocab-memory-v2`, tables `words`, `reviews` (synced) and `topics`, `enrichCache`, `meta` (local-only). Primary keys are client-generated **string ids** (`newId`) because Dexie Cloud rejects auto-increment keys and unique secondary indexes — so `key` is a plain index and de-duplication is done in code. The legacy numeric-id database `vocab-memory` is copied once and left untouched.
- **Cloud sync is opt-in at build time:** enabled only if `VITE_DEXIE_CLOUD_URL` is set (see `.env.example`); otherwise `cloudEnabled` is false and the Dexie cloud addon isn't loaded. `dexie-cloud.json`/`.key` and `.env.local` are git-ignored secrets.
- **Study logic:** `src/lib/srs.js` (SM-2 variant with Again/Hard/Good/Easy), `cloze.js`, `diff.js` (dictation diffing); UI modes are `ClozeCard`, `DictationCard`, `QuizCard` driven by `Session.jsx`/`StudyView.jsx`. `enrich.js` fetches dictionary IPA/audio/examples from a public API (rate-limited 2 req/s, cached in `enrichCache`); `speech.js` handles TTS.
- **PWA/Hosting:** `vite-plugin-pwa` (autoUpdate, `base: './'`) generates the service worker; `src/main.jsx` calls `registerSW` from `virtual:pwa-register` so the page reloads itself once a new service worker takes control (a plain reload then ends up on the new code). `public/_headers` makes `sw.js`, `registerSW.js`, manifest, `index.html` and `seed.json` always revalidate, with hashed assets immutable — keep that if adding new unhashed entry files.
