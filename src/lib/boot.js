import { db, cloudEnabled, migrateFromV1, dedupeByKey } from './db.js';
import { ensureTopics, seedIfFirstRun } from './importer.js';

/**
 * Start-up sequence.
 *  • local-only build: migrate old data → seed sample data on first run.
 *  • cloud build: migrate old data, but do NOT seed yet — a signed-in device must pull its
 *    cloud library first (otherwise two devices would each create the same 1,600 cards).
 *    `afterSync` (below) seeds only if the library is still empty once the pull finished.
 */
let bootPromise = null;
export function boot() {
  // single-flight: React StrictMode (dev) mounts effects twice, and two parallel migrations
  // would both see an empty library and copy everything twice.
  return (bootPromise ||= runBoot());
}

async function runBoot() {
  const moved = await migrateFromV1();
  await ensureTopics().catch(() => {});
  if (!cloudEnabled) await seedIfFirstRun().catch((e) => console.warn('seed failed', e));
  return { moved };
}

let syncing = false;

/** Call whenever the cloud reports "in-sync" for a signed-in user. */
export async function afterSync() {
  if (syncing) return;
  syncing = true;
  try {
    await ensureTopics().catch(() => {});
    const removed = await dedupeByKey();
    if (!(await db.words.count())) await seedIfFirstRun();
    return removed;
  } finally {
    syncing = false;
  }
}
