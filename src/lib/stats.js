import { dayKey, DAY, statusOf, isDue } from './db.js';

export function summarize(words, now = Date.now()) {
  const s = { total: words.length, new: 0, learning: 0, mastered: 0, due: 0 };
  for (const w of words) {
    s[statusOf(w)]++;
    if (isDue(w, now)) s.due++;
  }
  return s;
}

export function perTopic(words, topics) {
  const map = new Map(topics.map((t) => [t.id, { ...t, total: 0, new: 0, learning: 0, mastered: 0, due: 0 }]));
  const now = Date.now();
  for (const w of words) {
    const st = statusOf(w);
    const due = isDue(w, now);
    for (const id of w.topicIds) {
      const t = map.get(id);
      if (!t) continue;
      t.total++;
      t[st]++;
      if (due) t.due++;
    }
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

/** Last 7 days of review counts + current streak. */
export function streakInfo(reviews, now = Date.now()) {
  const counts = new Map();
  for (const r of reviews) counts.set(r.day, (counts.get(r.day) || 0) + 1);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(now - i * DAY);
    days.push({ day: k, count: counts.get(k) || 0, label: new Date(now - i * DAY).toLocaleDateString(undefined, { weekday: 'short' }) });
  }
  let streak = 0;
  let i = counts.get(dayKey(now)) ? 0 : 1; // today may still be empty
  while (counts.get(dayKey(now - i * DAY))) {
    streak++;
    i++;
  }
  return { days, streak, today: counts.get(dayKey(now)) || 0 };
}
