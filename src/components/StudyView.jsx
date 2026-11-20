import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Layers, BookOpen, CalendarClock, Mic, ListChecks } from 'lucide-react';
import { db, isDue, statusOf } from '../lib/db.js';
import { retryFailed, enqueue } from '../lib/enrich.js';
import { useSettings } from '../lib/settings.jsx';
import { Empty } from './ui.jsx';
import Session from './Session.jsx';

const MODES = [
  { id: 'cloze', label: 'Cloze flashcards', icon: Layers, desc: 'Meaning + blanked sentence → recall the word' },
  { id: 'dictation', label: 'Dictation', icon: Mic, desc: 'Listen and spell it' },
  { id: 'quiz', label: 'Quiz', icon: ListChecks, desc: '4-option multiple choice' },
];

function buildQueue(words, scope, size) {
  const now = Date.now();
  const due = words.filter((w) => isDue(w, now)).sort((a, b) => a.nextReview - b.nextReview);
  const fresh = (list) => list.filter((w) => statusOf(w) === 'new');
  switch (scope.type) {
    case 'due':
      return { list: due, label: `Due reviews (${due.length})` };
    case 'topic': {
      const inTopic = words.filter((w) => w.topicIds.includes(scope.id));
      const d = inTopic.filter((w) => isDue(w, now));
      const n = fresh(inTopic).slice(0, size);
      return { list: [...d, ...n], label: `Topic ${scope.id}` };
    }
    case 'chunk': {
      const chunk = words.slice(scope.index * size, scope.index * size + size);
      const list = chunk.filter((w) => isDue(w, now) || statusOf(w) === 'new');
      return { list: scope.all ? chunk : list, label: `Daily set ${scope.index + 1}` };
    }
    default: {
      const idx = firstChunkWithNew(words, size);
      return buildQueue(words, { type: 'chunk', index: idx }, size);
    }
  }
}

function firstChunkWithNew(words, size) {
  const i = words.findIndex((w) => statusOf(w) === 'new');
  return i < 0 ? 0 : Math.floor(i / size);
}

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export default function StudyView({ initialScope, go }) {
  const words = useLiveQuery(() => db.words.orderBy('order').toArray(), []);
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const { settings, update } = useSettings();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('daily');
  const [topicId, setTopicId] = useState(1);
  const [chunk, setChunk] = useState(null);
  const auto = useRef(false);
  const size = settings.sessionSize;

  const start = (scope) => {
    const { list, label } = buildQueue(words, scope, size);
    const capped = scope.type === 'due' ? list.slice(0, 60) : list;
    setSession({ scope, label, list: shuffleDue(capped), key: Date.now() });
  };

  useEffect(() => {
    if (words?.length && initialScope && !auto.current) {
      auto.current = true;
      start(initialScope);
    }
  }, [words]); // eslint-disable-line

  const chunks = useMemo(() => {
    if (!words) return [];
    const out = [];
    for (let i = 0; i < words.length; i += size) {
      const c = words.slice(i, i + size);
      out.push({ index: out.length, from: i + 1, to: i + c.length, mastered: c.filter((w) => statusOf(w) === 'mastered').length, fresh: c.filter((w) => statusOf(w) === 'new').length, due: c.filter((w) => isDue(w)).length });
    }
    return out;
  }, [words, size]);

  useEffect(() => { if (chunk === null && words) setChunk(firstChunkWithNew(words, size)); }, [words, size, chunk]);

  if (!words || !topics) return null;
  if (!words.length) return <Empty>Import your vocabulary first.<div className="mt-3"><button className="btn-primary" onClick={() => go('import')}>Go to Import</button></div></Empty>;

  if (session) {
    if (!session.list.length)
      return (
        <Empty>
          <p>Nothing due or new in “{session.label}” 🎉</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-outline" onClick={() => setSession(null)}>Back</button>
            {session.scope.type === 'chunk' && <button className="btn-primary" onClick={() => setSession({ ...session, list: words.slice(session.scope.index * size, session.scope.index * size + size) })}>Practice this set anyway</button>}
            {session.scope.type === 'topic' && <button className="btn-primary" onClick={() => setSession({ ...session, list: words.filter((w) => w.topicIds.includes(session.scope.id)) })}>Practice this topic anyway</button>}
          </div>
        </Empty>
      );
    return (
      <Session
        key={session.key}
        words={session.list}
        pool={words}
        topics={topics}
        mode={settings.mode}
        label={`${session.label} · ${MODES.find((m) => m.id === settings.mode).label}`}
        onExit={() => setSession(null)}
        onMore={session.scope.type === 'topic' || session.scope.type === 'daily' || session.scope.type === 'chunk' ? () => { const next = session.scope.type === 'chunk' ? { type: 'chunk', index: session.scope.index + 1 } : session.scope; start(next); } : null}
      />
    );
  }

  const due = words.filter((w) => isDue(w)).length;
  const tmeta = topics.map((t) => {
    const ws = words.filter((w) => w.topicIds.includes(t.id));
    return { ...t, due: ws.filter((w) => isDue(w)).length, fresh: ws.filter((w) => statusOf(w) === 'new').length, total: ws.length };
  });
  const failed = words.filter((w) => w.enrichStatus === 'error').length;
  const unenriched = words.filter((w) => w.enrichStatus === 'none').length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 font-semibold">1 · Choose a study mode</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map(({ id, label, icon: Icon, desc }) => (
            <button key={id} onClick={() => update({ mode: id })} className={`rounded-xl border p-3 text-left transition ${settings.mode === id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-300 hover:border-indigo-300 dark:border-slate-700'}`}>
              <Icon size={18} className="mb-1 text-indigo-500" />
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-slate-500">{desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">2 · Choose a deck</h2>
          <label className="flex items-center gap-2 text-xs text-slate-500">New words / session
            <select className="field !w-20 !py-1" value={size} onChange={(e) => { update({ sessionSize: +e.target.value }); setChunk(null); }}>
              {[10, 20, 30, 50].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
          {[['due', 'Due', CalendarClock], ['daily', 'Daily sets', Layers], ['topic', 'By topic', BookOpen]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${tab === id ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}><Icon size={14} />{label}</button>
          ))}
        </div>

        {tab === 'due' && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500"><b className="text-2xl text-slate-900 dark:text-slate-100">{due}</b> cards due for review (up to 60 per session).</p>
            <button className="btn-primary" disabled={!due} onClick={() => start({ type: 'due' })}><Play size={16} /> Start</button>
          </div>
        )}
        {tab === 'daily' && chunk !== null && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">The library is split into fixed sets of {size} words. Each session = the set’s new + due cards.</p>
            <div className="flex gap-2">
              <select className="field" value={chunk} onChange={(e) => setChunk(+e.target.value)}>
                {chunks.map((c) => <option key={c.index} value={c.index}>Set {c.index + 1} · words {c.from}–{c.to} · {c.mastered} mastered · {c.fresh} new{c.due ? ` · ${c.due} due` : ''}</option>)}
              </select>
              <button className="btn-primary" onClick={() => start({ type: 'chunk', index: chunk })}><Play size={16} /> Start</button>
            </div>
            <p className="text-xs text-slate-500">Preview: {words.slice(chunk * size, chunk * size + 6).map((w) => w.word).join(', ')}…</p>
          </div>
        )}
        {tab === 'topic' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <select className="field" value={topicId} onChange={(e) => setTopicId(+e.target.value)}>
                {tmeta.map((t) => <option key={t.id} value={t.id}>{t.id}. {t.title} · {t.total} words · {t.fresh} new{t.due ? ` · ${t.due} due` : ''}</option>)}
              </select>
              <button className="btn-primary" onClick={() => start({ type: 'topic', id: topicId })}><Play size={16} /> Start</button>
            </div>
          </div>
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500">
        <span>Dictionary data (IPA, audio, examples) loads on demand for the deck you open — {unenriched} cards not enriched yet{failed ? `, ${failed} failed` : ''}.</span>
        <div className="flex gap-2">
          {failed > 0 && <button className="btn-outline" onClick={retryFailed}>Retry failed</button>}
          {unenriched > 0 && <button className="btn-outline" onClick={() => enqueue(words.filter((w) => w.enrichStatus === 'none'))}>Enrich all in background</button>}
        </div>
      </section>
    </div>
  );
}

function shuffleDue(list) {
  // due cards keep their order (oldest first); new cards are interleaved randomly
  const due = list.filter((w) => isDue(w));
  const fresh = shuffle(list.filter((w) => !isDue(w)));
  return [...due, ...fresh];
}
