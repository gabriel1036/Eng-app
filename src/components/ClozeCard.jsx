import { useEffect, useState } from 'react';
import { pickExample, makeCloze } from '../lib/cloze.js';
import { CardBack, Chips, useAudio, useGuard, useKeys, isTyping } from './CardParts.jsx';
import { Kbd } from './ui.jsx';
import { diffChars } from '../lib/diff.js';

/** Mode A — contextual cloze flashcard. */
export default function ClozeCard({ word, front, topicTitles, onRate }) {
  const [phase, setPhase] = useState('front');
  const audio = useAudio(word);
  const guard = useGuard();
  // freeze the prompt at mount so it does not change when enrichment lands mid-card
  const [example] = useState(() => pickExample(front));
  const cloze = example ? makeCloze(example, front.word) : null;

  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);

  const reveal = () => { guard.arm(); setPhase('back'); };
  // A correct guess before reveal is rated Easy straight away
  const submit = () => (diffChars(typed, front.word).correct ? onRate(4) : setWrong(true));
  useEffect(() => { if (phase === 'back' && audio.settings.autoplay) audio.play(); }, [phase]); // eslint-disable-line

  useKeys((e) => {
    audio.onKey(e);
    if (isTyping(e)) return;
    if (phase === 'front' && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (phase === 'back' && '1234'.includes(e.key) && e.key && guard.ok()) onRate(+e.key);
  });

  if (phase === 'back')
    return <CardBack word={word} audio={audio} example={example} onRate={onRate} />;

  return (
    <div className="space-y-6 text-center">
      <Chips word={word} topicTitles={topicTitles} />
      <div className="text-3xl font-semibold sm:text-4xl">{word.meaning}</div>
      {cloze ? (
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-slate-700 dark:text-slate-200">
          {cloze.before}<span className="mx-1 inline-block min-w-[5.5rem] border-b-2 border-indigo-500 align-baseline text-transparent">_____</span>{cloze.after}
        </p>
      ) : (
        <p className="text-slate-500">
          Recall the English {word.pos?.includes('phr') ? 'phrase' : 'word'} <span className="text-slate-400">({word.word.length} letters)</span>
        </p>
      )}
      <form className="mx-auto max-w-xs space-y-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) submit(); }}>
        <input autoComplete="off" autoCapitalize="off" spellCheck={false} className="field text-center"
          placeholder="Know it? Type the word…" value={typed} onChange={(e) => { setTyped(e.target.value); setWrong(false); }} />
        {wrong && <p className="text-sm text-rose-600 dark:text-rose-400">Not quite — try again or show the answer</p>}
      </form>
      <button className="btn-primary" onClick={reveal}>Show answer <Kbd>Space</Kbd></button>
    </div>
  );
}
