import { useEffect, useRef, useState } from 'react';
import { Volume2, Turtle, Save } from 'lucide-react';
import { db, displayIpa } from '../lib/db.js';
import { previewInterval, RATINGS } from '../lib/srs.js';
import { speak } from '../lib/speech.js';
import { makeCloze } from '../lib/cloze.js';
import { useSettings } from '../lib/settings.jsx';
import { Kbd, PosBadge } from './ui.jsx';

export const isTyping = (e) => !!e.target.closest?.('input, textarea, select, [contenteditable="true"]');

/** One window-level keydown listener that always calls the latest handler. */
export function useKeys(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h = (e) => {
      if (e.metaKey || e.ctrlKey) return;
      ref.current(e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

/** Audio helper: play(rate?) + `R` / `Shift+R` replay shortcuts (Alt+R while typing). */
export function useAudio(word) {
  const { settings } = useSettings();
  const play = (rate) => speak(word, { accent: settings.accent, voiceURI: settings.voiceURI, rate: rate ?? settings.speed });
  const other = settings.speed === 1 ? 0.75 : 1;
  const onKey = (e) => {
    if (e.code !== 'KeyR') return;
    if (isTyping(e) && !e.altKey) return;
    e.preventDefault();
    play(e.shiftKey ? other : settings.speed);
  };
  return { play, onKey, settings };
}

export function Chips({ word, topicTitles }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <PosBadge pos={word.pos} />
      {word.topicIds.slice(0, 2).map((id) => (
        <span key={id} className="badge bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">#{id} {topicTitles.get(id)}</span>
      ))}
      {word.topicIds.length > 2 && <span className="badge bg-slate-200 text-slate-600 dark:bg-slate-800">+{word.topicIds.length - 2}</span>}
    </div>
  );
}

export function SpeakerButtons({ play, settings }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button className="btn-outline" onClick={() => play(1)} title="Play (R)"><Volume2 size={16} /> Play</button>
      <button className="btn-outline" onClick={() => play(0.75)} title="Slow 0.75× (Shift+R)"><Turtle size={16} /> 0.75×</button>
      <span className="hidden text-xs text-slate-500 sm:inline"><Kbd>R</Kbd> replay · <Kbd>⇧R</Kbd> {settings.speed === 1 ? '0.75×' : '1×'}</span>
    </div>
  );
}

function Highlighted({ sentence, word }) {
  const c = makeCloze(sentence, word.word);
  if (!c) return <>{sentence}</>;
  return <>{c.before}<mark className="rounded bg-indigo-100 px-1 font-semibold text-indigo-800 dark:bg-indigo-500/25 dark:text-indigo-200">{c.answer}</mark>{c.after}</>;
}

/** Revealed side: word, IPA, audio, sentences, "write your own sentence", then rating bar. */
export function CardBack({ word, audio, example, onRate, recommended, locked }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const mine = word.userSentences || [];

  const save = async () => {
    const t = text.trim();
    if (!t) return;
    await db.words.update(word.id, { userSentences: [...mine, { text: t, ts: Date.now() }] });
    setText('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight sm:text-4xl">{word.word}</div>
        <div className="ipa mt-1 text-xl text-indigo-600 dark:text-indigo-300">{displayIpa(word) || <span className="text-sm text-slate-400">no IPA</span>}</div>
        <div className="mt-1 text-slate-500">{word.meaning}</div>
      </div>
      <SpeakerButtons play={audio.play} settings={audio.settings} />
      {(example || word.definition) && (
        <div className="space-y-2 rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-800/60">
          {example && <p className="text-base"><Highlighted sentence={example} word={word} /></p>}
          {word.definition && <p className="text-slate-500"><span className="font-medium">Definition:</span> {word.definition}</p>}
          {(word.examples || []).filter((e) => e !== example).slice(0, 2).map((e) => (
            <p key={e} className="text-slate-500"><Highlighted sentence={e} word={word} /></p>
          ))}
        </div>
      )}
      {mine.length > 0 && (
        <div className="rounded-xl border border-dashed border-indigo-300 p-3 text-sm dark:border-indigo-500/40">
          <div className="mb-1 text-xs font-medium uppercase text-indigo-500">Your sentences</div>
          {mine.slice(-3).map((s) => <p key={s.ts}>“<Highlighted sentence={s.text} word={word} />”</p>)}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="mine">Write your own sentence</label>
        <div className="flex gap-2">
          <textarea id="mine" rows={2} className="field resize-none" placeholder={`Use “${word.word}” in a sentence about your life…`} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }} />
          <button className="btn-outline self-stretch" onClick={save} disabled={!text.trim()}><Save size={16} /> {saved ? 'Saved' : 'Save'}</button>
        </div>
      </div>
      <RatingBar word={word} onRate={onRate} recommended={recommended} locked={locked} />
    </div>
  );
}

export function RatingBar({ word, onRate, recommended, locked }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <button key={r.id} disabled={locked} onClick={() => onRate(r.id)}
            className={`btn flex-col !gap-0 !py-2.5 text-white ${r.color} ${recommended === r.id ? 'ring-2 ring-offset-2 ring-indigo-400 dark:ring-offset-slate-900' : ''}`}>
            <span>{r.label}</span>
            <span className="text-[11px] font-normal opacity-80">{previewInterval(word, r.id)}</span>
            <span className="mt-0.5 rounded bg-black/20 px-1 text-[10px]">{r.id}</span>
          </button>
        ))}
      </div>
      {recommended && <p className="mt-2 text-center text-xs text-slate-500">Suggested: <b>{RATINGS[recommended - 1].label}</b> · press <Kbd>1</Kbd>–<Kbd>4</Kbd></p>}
    </div>
  );
}

/** Ignore number keys for a short moment after a state change to avoid accidental double-rating. */
export function useGuard(ms = 350) {
  const t = useRef(0);
  return { arm: () => (t.current = Date.now()), ok: () => Date.now() - t.current > ms };
}
