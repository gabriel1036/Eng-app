import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Volume2 } from 'lucide-react';
import { db, displayIpa, statusOf, isDue } from '../lib/db.js';
import { stripDiacritics } from '../lib/normalize.js';
import { prioritize } from '../lib/enrich.js';
import { speak } from '../lib/speech.js';
import { useSettings } from '../lib/settings.jsx';
import { Empty, PosBadge, StatusBadge } from './ui.jsx';
import WordModal from './WordModal.jsx';

const PAGE = 50;

export default function DictionaryView() {
  const words = useLiveQuery(() => db.words.orderBy('order').toArray(), []);
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const { settings } = useSettings();
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [pos, setPos] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);

  const posList = useMemo(() => [...new Set((words || []).map((w) => w.pos))].sort(), [words]);
  const filtered = useMemo(() => {
    if (!words) return [];
    const n = stripDiacritics(q.trim().toLowerCase());
    return words.filter((w) => {
      if (topic && !w.topicIds.includes(+topic)) return false;
      if (pos && w.pos !== pos) return false;
      if (status === 'due' ? !isDue(w) : status && statusOf(w) !== status) return false;
      return !n || w.word.toLowerCase().includes(n) || stripDiacritics(w.meaning.toLowerCase()).includes(n);
    });
  }, [words, q, topic, pos, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, (page + 1) * PAGE);
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);
  // Enrich what the user is looking at first.
  useEffect(() => { if (view.length) prioritize(view); }, [page, topic, q, pos, status]); // eslint-disable-line

  if (!words) return null;
  if (!words.length) return <Empty>No words yet — import the PDF first.</Empty>;
  const reset = (fn) => (e) => { fn(e.target.value); setPage(0); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="field !pl-9" placeholder="Search English or Vietnamese (accents optional)…" value={q} onChange={reset(setQ)} />
        </div>
        <select className="field !w-56" value={topic} onChange={reset(setTopic)}>
          <option value="">All topics</option>
          {(topics || []).map((t) => <option key={t.id} value={t.id}>{t.id}. {t.title}</option>)}
        </select>
        <select className="field !w-32" value={pos} onChange={reset(setPos)}>
          <option value="">All POS</option>
          {posList.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select className="field !w-36" value={status} onChange={reset(setStatus)}>
          <option value="">Any status</option>
          <option value="new">New</option><option value="learning">Learning</option><option value="mastered">Mastered</option><option value="due">Due now</option>
        </select>
      </div>
      <div className="text-sm text-slate-500">{filtered.length} of {words.length} cards</div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
            <tr><th className="p-3">Word</th><th className="p-3">POS</th><th className="p-3">IPA</th><th className="p-3">Meaning</th><th className="p-3">Topics</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {view.map((w) => (
              <tr key={w.id} className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setOpen(w.id)}>
                <td className="p-3 font-medium">
                  <span className="flex items-center gap-1">
                    {w.word}
                    <button className="btn-ghost !p-1" aria-label="Play" onClick={(e) => { e.stopPropagation(); speak(w, { accent: settings.accent, voiceURI: settings.voiceURI, rate: settings.speed }); }}><Volume2 size={14} /></button>
                  </span>
                </td>
                <td className="p-3"><PosBadge pos={w.pos} /></td>
                <td className="ipa p-3 text-slate-600 dark:text-slate-300">{displayIpa(w)}</td>
                <td className="p-3">{w.meaning}</td>
                <td className="p-3 text-xs text-slate-500">{w.topicIds.join(', ')}</td>
                <td className="p-3"><StatusBadge status={statusOf(w)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <button className="btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
        <span>Page {page + 1} / {pages}</span>
        <button className="btn-outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      {open && <WordModal id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
