import { useState } from 'react';
import { Volume2, Trash2, Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, displayIpa, statusOf } from '../lib/db.js';
import { formatInterval } from '../lib/srs.js';
import { speak } from '../lib/speech.js';
import { useSettings } from '../lib/settings.jsx';
import { Modal, PosBadge, StatusBadge } from './ui.jsx';

export default function WordModal({ id, onClose }) {
  const w = useLiveQuery(() => db.words.get(id), [id]);
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const { settings } = useSettings();
  const [ex, setEx] = useState('');
  if (!w) return null;
  const tmap = new Map((topics || []).map((t) => [t.id, t.title]));
  const save = (patch) => db.words.update(id, patch);
  const play = () => speak(w, { accent: settings.accent, voiceURI: settings.voiceURI, rate: settings.speed });

  return (
    <Modal title={w.word} onClose={onClose} wide>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <PosBadge pos={w.pos} /> <StatusBadge status={statusOf(w)} />
          <span className="ipa text-base text-slate-600 dark:text-slate-300">{displayIpa(w)}</span>
          <button className="btn-ghost !p-1.5" onClick={play} aria-label="Play"><Volume2 size={18} /></button>
        </div>
        <label className="block">
          <span className="text-xs text-slate-500">Vietnamese meaning</span>
          <input className="field mt-1" defaultValue={w.meaning} onBlur={(e) => save({ meaning: e.target.value.trim() })} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">PDF IPA (fallback)</span>
          <input className="field ipa mt-1" defaultValue={w.ipa} onBlur={(e) => save({ ipa: e.target.value.trim() })} />
        </label>
        {w.definition && <p><span className="text-xs text-slate-500">Definition: </span>{w.definition}</p>}
        <div>
          <div className="mb-1 text-xs text-slate-500">Topics</div>
          <div className="flex flex-wrap gap-1.5">{w.topicIds.map((t) => <span key={t} className="badge bg-slate-200 dark:bg-slate-800">{t}. {tmap.get(t)}</span>)}</div>
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-500">Example sentences (editable)</div>
          <textarea className="field" rows={3} defaultValue={(w.examples || []).join('\n')} placeholder="One example per line — must contain the word for cloze cards"
            onBlur={(e) => save({ examples: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
        </div>
        <div>
          <div className="mb-1 text-xs text-slate-500">My sentences</div>
          <ul className="mb-2 space-y-1">
            {(w.userSentences || []).map((s, i) => (
              <li key={s.ts} className="flex items-start gap-2 rounded bg-slate-100 px-2 py-1.5 dark:bg-slate-800">
                <span className="flex-1">{s.text}</span>
                <button className="text-slate-400 hover:text-rose-500" onClick={() => save({ userSentences: w.userSentences.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className="field" value={ex} onChange={(e) => setEx(e.target.value)} placeholder="Write your own sentence…"
              onKeyDown={(e) => { if (e.key === 'Enter' && ex.trim()) { save({ userSentences: [...(w.userSentences || []), { text: ex.trim(), ts: Date.now() }] }); setEx(''); } }} />
            <button className="btn-outline" onClick={() => { if (ex.trim()) { save({ userSentences: [...(w.userSentences || []), { text: ex.trim(), ts: Date.now() }] }); setEx(''); } }}><Plus size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800 sm:grid-cols-4">
          <div>Ease <b>{w.easeFactor}</b></div>
          <div>Interval <b>{w.lastReview ? formatInterval(w.interval) : '—'}</b></div>
          <div>Reps <b>{w.repetitions}</b> · lapses <b>{w.lapses}</b></div>
          <div>Next <b>{w.lastReview ? new Date(w.nextReview).toLocaleString() : 'new'}</b></div>
        </div>
        <div className="flex justify-between">
          <button className="btn-ghost text-rose-600" onClick={async () => { if (confirm('Reset progress for this card?')) await save({ easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: 0, lastReview: 0, lapses: 0 }); }}>Reset progress</button>
          <button className="btn-ghost text-rose-600" onClick={async () => { if (confirm('Delete this card?')) { await db.words.delete(id); onClose(); } }}>Delete card</button>
        </div>
      </div>
    </Modal>
  );
}
