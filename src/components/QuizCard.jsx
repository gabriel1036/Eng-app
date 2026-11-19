import { useEffect, useState } from 'react';
import { makeCloze, pickExample } from '../lib/cloze.js';
import { CardBack, Chips, useAudio, useGuard, useKeys, isTyping } from './CardParts.jsx';

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function buildQuestion(word, front, pool) {
  const example = pickExample(front);
  const kinds = ['meaning2word', 'word2meaning', ...(example ? ['cloze', 'cloze'] : [])];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const field = kind === 'word2meaning' ? 'meaning' : 'word';
  // distractors: same topic first, then same POS, then anything
  const ok = (w) => w.id !== word.id && w[field].toLowerCase() !== word[field].toLowerCase();
  const tiers = [
    pool.filter((w) => ok(w) && w.pos === word.pos && w.topicIds.some((t) => word.topicIds.includes(t))),
    pool.filter((w) => ok(w) && w.topicIds.some((t) => word.topicIds.includes(t))),
    pool.filter((w) => ok(w) && w.pos === word.pos),
    pool.filter(ok),
  ];
  const chosen = [];
  const seen = new Set([word[field].toLowerCase()]);
  for (const tier of tiers) {
    for (const w of shuffle(tier)) {
      if (chosen.length >= 3) break;
      const k = w[field].toLowerCase();
      if (!seen.has(k)) { seen.add(k); chosen.push(w); }
    }
  }
  const options = shuffle([word, ...chosen]).map((w) => ({ id: w.id, text: w[field] }));
  return { kind, example, options, correctId: word.id };
}

/** Mode C — context & topic multiple-choice quiz. */
export default function QuizCard({ word, front, pool, topicTitles, onRate }) {
  const [q] = useState(() => buildQuestion(front, front, pool));
  const [picked, setPicked] = useState(null);
  const audio = useAudio(word);
  const guard = useGuard(400);
  const correct = picked === q.correctId;

  useEffect(() => { if (picked !== null && audio.settings.autoplay) audio.play(); }, [picked]); // eslint-disable-line

  const choose = (i) => {
    if (picked !== null || !q.options[i]) return;
    guard.arm();
    setPicked(q.options[i].id);
  };

  useKeys((e) => {
    audio.onKey(e);
    if (isTyping(e) || !'1234'.includes(e.key) || !e.key) return;
    if (picked === null) choose(+e.key - 1);
    else if (guard.ok()) onRate(+e.key);
  });

  const cloze = q.kind === 'cloze' ? makeCloze(q.example, front.word) : null;
  const prompt =
    q.kind === 'meaning2word' ? 'Which English word or phrase means…' :
    q.kind === 'word2meaning' ? 'What does this mean in Vietnamese?' : 'Fill in the blank';

  return (
    <div className="space-y-5">
      <div className="space-y-3 text-center">
        <Chips word={word} topicTitles={topicTitles} />
        <div className="text-xs uppercase tracking-wide text-slate-500">{prompt}</div>
        {q.kind === 'meaning2word' && <div className="text-3xl font-semibold">{word.meaning}</div>}
        {q.kind === 'word2meaning' && <div className="text-3xl font-semibold">{word.word}</div>}
        {cloze && <p className="mx-auto max-w-xl text-lg leading-relaxed">{cloze.before}<span className="mx-1 inline-block min-w-[5rem] border-b-2 border-indigo-500 text-center">{picked !== null ? cloze.answer : ''}</span>{cloze.after}</p>}
        {cloze && <div className="text-sm text-slate-500">{word.meaning}</div>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const state = picked === null ? '' : o.id === q.correctId ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50' : o.id === picked ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50' : 'opacity-60';
          return (
            <button key={o.id} disabled={picked !== null} onClick={() => choose(i)}
              className={`flex items-center gap-3 rounded-xl border border-slate-300 p-3 text-left transition hover:border-indigo-400 dark:border-slate-700 ${state}`}>
              <span className="kbd shrink-0">{i + 1}</span><span>{o.text}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <div className={`text-center text-sm font-medium ${correct ? 'text-emerald-600' : 'text-rose-600'}`}>{correct ? '✓ Correct' : '✗ Incorrect'}</div>
          <CardBack word={word} audio={audio} example={q.example} onRate={onRate} recommended={correct ? 3 : 1} />
        </>
      )}
    </div>
  );
}
