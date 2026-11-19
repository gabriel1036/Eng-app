import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Play, Download } from 'lucide-react';
import { db } from '../lib/db.js';
import { summarize, perTopic, streakInfo } from '../lib/stats.js';
import { StackedBar } from './ui.jsx';
import { loadSeed } from '../lib/importer.js';
import { useState } from 'react';

function Stat({ label, value, tone }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${tone || ''}`}>{value}</div>
    </div>
  );
}

export default function Dashboard({ go, wordCount }) {
  const words = useLiveQuery(() => db.words.toArray(), []);
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const reviews = useLiveQuery(() => db.reviews.where('ts').above(Date.now() - 400 * 86400000).toArray(), []);
  const [busy, setBusy] = useState(false);

  if (!words || !topics || !reviews) return null;

  if (!words.length)
    return (
      <div className="card mx-auto max-w-xl p-10 text-center">
        <h1 className="text-2xl font-semibold">Welcome 👋</h1>
        <p className="mt-2 text-slate-500">Import your vocabulary PDF to start learning with spaced repetition.</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button className="btn-primary" onClick={() => go('import')}>Import PDF</button>
          <button className="btn-outline" disabled={busy} onClick={async () => { setBusy(true); try { await loadSeed(); } finally { setBusy(false); } }}>
            <Download size={16} /> {busy ? 'Loading…' : 'Load pre-parsed Oxford 3000 data'}
          </button>
        </div>
      </div>
    );

  const s = summarize(words);
  const st = streakInfo(reviews);
  const tp = perTopic(words, topics);
  const max = Math.max(1, ...st.days.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card col-span-2 flex items-center justify-between gap-4 bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white lg:col-span-1 lg:flex-col lg:items-start">
          <div>
            <div className="text-xs uppercase tracking-wide text-indigo-100">Due for review</div>
            <div className="text-5xl font-bold tabular-nums">{s.due}</div>
          </div>
          <button className="btn bg-white text-indigo-700 hover:bg-indigo-50" onClick={() => go('study', { type: s.due ? 'due' : 'daily' })}>
            <Play size={16} /> {s.due ? 'Review now' : 'Study new words'}
          </button>
        </div>
        <Stat label="New" value={s.new} />
        <Stat label="Learning" value={s.learning} tone="text-amber-500" />
        <Stat label="Mastered" value={s.mastered} tone="text-emerald-500" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-1 font-semibold">Overall progress</h2>
          <p className="mb-3 text-sm text-slate-500">{s.mastered} mastered · {s.learning} learning · {s.new} new of {s.total} cards</p>
          <StackedBar {...s} className="!h-3" />
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <Legend c="bg-emerald-500" t="Mastered (interval ≥ 21d)" /><Legend c="bg-amber-400" t="Learning" /><Legend c="bg-slate-300 dark:bg-slate-700" t="New" />
          </div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">7-day streak</h2>
            <span className="flex items-center gap-1 text-sm font-medium text-orange-500"><Flame size={16} /> {st.streak} day{st.streak === 1 ? '' : 's'}</span>
          </div>
          <div className="mt-4 flex h-24 items-end gap-2">
            {st.days.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.count} reviews`}>
                <div className={`w-full rounded-t ${d.count ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }} />
                <span className="text-[10px] text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">{st.today} reviews today</p>
        </section>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Topics</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tp.map((t) => (
            <button key={t.id} onClick={() => go('study', { type: 'topic', id: t.id })} className="card p-3 text-left transition hover:border-indigo-400">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium"><span className="text-slate-400">{t.id}.</span> {t.title}</span>
                {t.due > 0 && <span className="badge shrink-0 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">{t.due} due</span>}
              </div>
              <StackedBar {...t} className="my-2" />
              <div className="text-xs text-slate-500">{t.mastered}/{t.total} mastered · {t.new} new</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const Legend = ({ c, t }) => <span className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${c}`} />{t}</span>;
