import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Loader2, Trophy } from 'lucide-react';
import { db, dayKey, newId } from '../lib/db.js';
import { schedule } from '../lib/srs.js';
import { prioritize, waitForEnrichment } from '../lib/enrich.js';
import { stopSpeech } from '../lib/speech.js';
import { useSettings } from '../lib/settings.jsx';
import ClozeCard from './ClozeCard.jsx';
import DictationCard from './DictationCard.jsx';
import QuizCard from './QuizCard.jsx';
import { Kbd } from './ui.jsx';

const MODES = { cloze: ClozeCard, dictation: DictationCard, quiz: QuizCard };

export default function Session({ words: initial, pool, topics, mode, label, onExit, onMore }) {
  const { settings, update } = useSettings();
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState(() => initial.map((w) => w.id));
  const [turn, setTurn] = useState(0);
  const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const total = useRef(initial.length);
  const done = useRef(new Set());
  const busy = useRef(false);
  const initialMap = useMemo(() => new Map(initial.map((w) => [w.id, w])), [initial]);
  const topicTitles = useMemo(() => new Map(topics.map((t) => [t.id, t.title])), [topics]);

  // Enrich the active deck first, and give the first cards a moment to receive IPA/examples.
  useEffect(() => {
    let alive = true;
    prioritize(initial);
    waitForEnrichment(initial.slice(0, 3).map((w) => w.id), 2200).then(() => alive && setReady(true));
    return () => { alive = false; stopSpeech(); };
  }, [initial]);

  const currentId = queue[0];
  const live = useLiveQuery(() => (currentId ? db.words.get(currentId) : null), [currentId, turn]);
  const word = live || initialMap.get(currentId);
  const front = initialMap.get(currentId) ? { ...initialMap.get(currentId), ...(live || {}) } : word;

  async function rate(r) {
    if (busy.current || !word) return;
    busy.current = true;
    try {
      const patch = schedule(word, r);
      await db.words.update(word.id, patch);
      await db.reviews.add({ id: newId('rev'), wordId: word.id, ts: Date.now(), day: dayKey(), rating: r, mode, interval: patch.interval });
      stopSpeech();
      setCounts((c) => ({ ...c, [r]: c[r] + 1 }));
      setQueue((q) => {
        const [head, ...rest] = q;
        if (r === 1) rest.splice(Math.min(3, rest.length), 0, head); // see "Again" cards again soon
        else done.current.add(head);
        return rest;
      });
      setTurn((t) => t + 1);
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && !e.target.closest?.('input,textarea') && onExit();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onExit]);

  if (!ready)
    return <div className="grid place-items-center py-24 text-slate-500"><Loader2 className="mb-3 animate-spin" size={28} />Preparing your deck…</div>;

  const reviewed = counts[1] + counts[2] + counts[3] + counts[4];
  const Card = MODES[mode];

  if (!queue.length) {
    const good = counts[3] + counts[4];
    return (
      <div className="card mx-auto max-w-lg space-y-5 p-8 text-center">
        <Trophy className="mx-auto text-amber-500" size={40} />
        <h2 className="text-2xl font-semibold">Session complete</h2>
        <p className="text-slate-500">{label}</p>
        <div className="grid grid-cols-4 gap-2 text-sm">
          {['Again', 'Hard', 'Good', 'Easy'].map((n, i) => <div key={n} className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800"><div className="text-xl font-semibold">{counts[i + 1]}</div>{n}</div>)}
        </div>
        <p className="text-sm">{reviewed ? Math.round((good / reviewed) * 100) : 0}% recalled well · {total.current} cards</p>
        <div className="flex justify-center gap-2">
          <button className="btn-outline" onClick={onExit}>Back</button>
          {onMore && <button className="btn-primary" onClick={onMore}>Next {settings.sessionSize} words</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !p-2" onClick={onExit} aria-label="Exit session" title="Exit (Esc)"><X size={18} /></button>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(done.current.size / Math.max(1, total.current)) * 100}%` }} />
          </div>
        </div>
        <span className="text-sm tabular-nums text-slate-500">{done.current.size}/{total.current}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <select className="rounded border border-slate-300 bg-transparent px-1 py-0.5 dark:border-slate-700" value={settings.accent} onChange={(e) => update({ accent: e.target.value, voiceURI: '' })}>
            <option value="us">🇺🇸 US</option><option value="uk">🇬🇧 UK</option>
          </select>
          <button className="rounded border border-slate-300 px-1.5 py-0.5 dark:border-slate-700" onClick={() => update({ speed: settings.speed === 1 ? 0.75 : 1 })}>{settings.speed}×</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={settings.autoplay} onChange={(e) => update({ autoplay: e.target.checked })} /> auto-play</label>
        </div>
      </div>
      <div className="card p-5 sm:p-8">
        {word && <Card key={`${word.id}-${turn}`} word={word} front={front} pool={pool} topicTitles={topicTitles} onRate={rate} />}
      </div>
      <p className="text-center text-xs text-slate-500">
        <Kbd>Space</Kbd> flip · <Kbd>1</Kbd>–<Kbd>4</Kbd> rate · <Kbd>R</Kbd> replay · <Kbd>Esc</Kbd> exit
      </p>
    </div>
  );
}
