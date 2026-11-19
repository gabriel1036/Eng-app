// SM-2 variant with fixed first-step intervals matching the button labels:
//   Again <1m · Hard 12h · Good 1d · Easy 4d   (then 6d / 8d, then interval × EF)
import { DAY } from './db.js';

export const RATINGS = [
  { id: 1, key: 'again', label: 'Again', color: 'bg-rose-600 hover:bg-rose-500' },
  { id: 2, key: 'hard', label: 'Hard', color: 'bg-amber-600 hover:bg-amber-500' },
  { id: 3, key: 'good', label: 'Good', color: 'bg-emerald-600 hover:bg-emerald-500' },
  { id: 4, key: 'easy', label: 'Easy', color: 'bg-sky-600 hover:bg-sky-500' },
];

const MIN_EF = 1.3;
const ONE_MINUTE_DAYS = 1 / 1440;

export function schedule(card, rating, now = Date.now()) {
  let { easeFactor: ef = 2.5, interval = 0, repetitions: reps = 0, lapses = 0 } = card;
  switch (rating) {
    case 1: // again
      ef = Math.max(MIN_EF, ef - 0.2);
      reps = 0;
      interval = ONE_MINUTE_DAYS;
      lapses += 1;
      break;
    case 2: // hard
      ef = Math.max(MIN_EF, ef - 0.15);
      interval = reps === 0 ? 0.5 : Math.max(1, interval * 1.2);
      break;
    case 3: // good
      interval = reps === 0 ? 1 : reps === 1 ? 6 : Math.max(interval + 1, Math.round(interval * ef));
      reps += 1;
      break;
    default: // easy
      ef += 0.15;
      interval = reps === 0 ? 4 : reps === 1 ? 8 : Math.max(interval + 2, Math.round(interval * ef * 1.3));
      reps += 1;
  }
  return {
    easeFactor: Math.round(ef * 100) / 100,
    interval,
    repetitions: reps,
    lapses,
    lastReview: now,
    nextReview: now + interval * DAY,
  };
}

export function previewInterval(card, rating) {
  return formatInterval(schedule(card, rating).interval);
}

export function formatInterval(days) {
  if (days < 1 / 24) return '<1m';
  if (days < 1) return `${Math.round(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
