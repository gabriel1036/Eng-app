import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { diffChars, similarity } from '../lib/diff.js';
import { CardBack, Chips, SpeakerButtons, useAudio, useGuard, useKeys, isTyping } from './CardParts.jsx';

const cls = (ok) => (ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400 underline decoration-wavy');

function Marks({ marks }) {
  return <span className="font-mono text-2xl tracking-wide">{marks.map((m, i) => <span key={i} className={cls(m.ok)}>{m.ch === ' ' ? ' ' : m.ch}</span>)}</span>;
}

/** Mode B — dictation & spelling with live character diff. */
export default function DictationCard({ word, topicTitles, onRate }) {
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const input = useRef();
  const audio = useAudio(word);
  const guard = useGuard();

  useEffect(() => { const t = setTimeout(() => audio.play(), 150); return () => clearTimeout(t); }, []); // eslint-disable-line

  const check = (giveUp = false) => {
    const d = diffChars(giveUp ? '' : typed, word.word);
    const sim = giveUp ? 0 : similarity(typed, word.word);
    guard.arm();
    setResult({ ...d, rec: d.correct ? 3 : sim >= 0.8 ? 2 : 1, typed: giveUp ? '' : typed });
    input.current?.blur();
  };

  useKeys((e) => {
    audio.onKey(e);
    if (result && !isTyping(e) && '1234'.includes(e.key) && e.key && guard.ok()) onRate(+e.key);
  });

  const live = typed ? diffChars(typed, word.word) : null;

  if (result)
    return (
      <div className="space-y-5">
        <div className={`rounded-xl p-4 text-center ${result.correct ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}`}>
          <div className="mb-2 text-sm font-medium">{result.correct ? '✓ Correct' : '✗ Not quite'}</div>
          {!result.correct && result.typed && <div className="mb-1"><Marks marks={result.typedMarks} /></div>}
          {!result.correct && <div className="text-sm text-slate-500">answer</div>}
          <Marks marks={result.targetMarks.map((m) => ({ ...m, ok: true }))} />
        </div>
        <CardBack word={word} audio={audio} example={null} onRate={onRate} recommended={result.rec} />
      </div>
    );

  return (
    <div className="space-y-5 text-center">
      <Chips word={word} topicTitles={topicTitles} />
      <button className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-500" onClick={() => audio.play()} aria-label="Play pronunciation">
        <Volume2 size={32} />
      </button>
      <SpeakerButtons play={audio.play} settings={audio.settings} />
      <div className="text-2xl font-semibold">{word.meaning}</div>
      <form className="mx-auto max-w-md space-y-3" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) check(); }}>
        <input ref={input} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} className="field !py-3 text-center text-lg"
          placeholder="Type what you hear…" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="min-h-[2rem]">{live && <Marks marks={live.typedMarks} />}</div>
        <div className="flex justify-center gap-2">
          <button type="submit" className="btn-primary" disabled={!typed.trim()}>Check ↵</button>
          <button type="button" className="btn-ghost" onClick={() => check(true)}>I don’t know</button>
        </div>
        <p className="text-xs text-slate-500">Press <kbd className="kbd">Alt</kbd>+<kbd className="kbd">R</kbd> to replay while typing</p>
      </form>
    </div>
  );
}
