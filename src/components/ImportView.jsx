import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp, Download, Upload, Trash2, AlertTriangle, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { parsePdfData } from '../lib/pdfParser.js';
import { mergeRows, loadSeed, wipeAll } from '../lib/importer.js';
import { exportBackup, importBackup, db } from '../lib/db.js';
import { makeKey } from '../lib/normalize.js';

const PAGE = 100;
let rid = 0;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ImportView({ go }) {
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState(null); // {topics, warnings}
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [topicFilter, setTopicFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const pdfInput = useRef();
  const jsonInput = useRef();
  const libCount = useLiveQuery(() => db.words.count(), [], 0);

  const flash = (type, text) => setMsg({ type, text });

  async function handlePdf(file) {
    if (!file) return;
    setStage('parsing');
    setProgress(0);
    setMsg(null);
    try {
      const pdfjs = await loadPdfjs();
      const data = new Uint8Array(await file.arrayBuffer());
      const res = await parsePdfData(pdfjs, data, (p, n) => setProgress(p / n));
      if (!res.rows.length) throw new Error('No vocabulary rows found. Is this the 4-column topic PDF?');
      setParsed({ topics: res.topics, warnings: res.warnings });
      setRows(res.rows.map((r) => ({ ...r, _id: ++rid })));
      setStage('preview');
      setPage(0);
    } catch (e) {
      console.error(e);
      flash('error', `Could not parse PDF: ${e.message}`);
      setStage('idle');
    }
  }

  const topicTitle = useMemo(() => new Map((parsed?.topics || []).map((t) => [t.id, t.title])), [parsed]);
  const dupCount = useMemo(() => {
    const seen = new Set();
    let d = 0;
    for (const r of rows) {
      const k = makeKey(r.word, r.pos);
      if (seen.has(k)) d++;
      else seen.add(k);
    }
    return d;
  }, [rows]);
  const issueCount = rows.filter((r) => r.issues?.length).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!onlyIssues || r.issues?.length) &&
        (!topicFilter || r.topicId === +topicFilter) &&
        (!needle || r.word.toLowerCase().includes(needle) || r.meaning.toLowerCase().includes(needle)),
    );
  }, [rows, onlyIssues, topicFilter, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const edit = (id, patch) => setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch, issues: [] } : r)));
  const remove = (id) => setRows((rs) => rs.filter((r) => r._id !== id));
  const addRow = () => {
    const topicId = topicFilter ? +topicFilter : parsed.topics[0]?.id ?? 1;
    setRows((rs) => [...rs, { _id: ++rid, topicId, word: '', pos: 'n', ipa: '', meaning: '', issues: [] }]);
    setPage(Math.max(0, Math.ceil((filtered.length + 1) / PAGE) - 1));
  };

  async function commit() {
    try {
      const clean = rows.filter((r) => r.word.trim());
      const { added, merged } = await mergeRows(clean, parsed.topics);
      flash('ok', `Imported: ${added} new cards, ${merged} duplicate rows merged into existing cards (topic tags combined).`);
      setStage('idle');
      setRows([]);
    } catch (e) {
      flash('error', e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Import & backup</h1>
        <p className="text-sm text-slate-500">PDF is parsed locally in your browser using X/Y text coordinates — nothing is uploaded. Library: <b>{libCount}</b> cards.</p>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${msg.type === 'ok'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'}`}>
          {msg.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} <span>{msg.text}</span>
          {msg.type === 'ok' && <button className="ml-auto underline" onClick={() => go('dashboard')}>Dashboard →</button>}
        </div>
      )}

      {stage !== 'preview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="card flex flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handlePdf(e.dataTransfer.files[0]); }}
          >
            {stage === 'parsing' ? (
              <>
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <div className="text-sm">Parsing… {Math.round(progress * 100)}%</div>
                <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-indigo-500" style={{ width: `${progress * 100}%` }} /></div>
              </>
            ) : (
              <>
                <FileUp size={32} className="text-indigo-500" />
                <div className="font-medium">Drop the vocabulary PDF here</div>
                <button className="btn-primary" onClick={() => pdfInput.current.click()}>Choose PDF</button>
                <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => { handlePdf(e.target.files[0]); e.target.value = ''; }} />
                <p className="text-xs text-slate-500">Skips cover/TOC (pages 1–3), page numbers, repeated table headers.</p>
              </>
            )}
          </div>

          <div className="card space-y-3 p-6">
            <h2 className="font-semibold">Other sources</h2>
            <button className="btn-outline w-full justify-start" onClick={async () => { try { const r = await loadSeed(); flash('ok', `Loaded pre-parsed data: ${r.added} new, ${r.merged} merged.`); } catch (e) { flash('error', e.message); } }}>
              <Download size={16} /> Load pre-parsed Oxford 3000 data
            </button>
            <button className="btn-outline w-full justify-start" onClick={async () => download(`vocab-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup()))}>
              <Download size={16} /> Export backup (.json)
            </button>
            <button className="btn-outline w-full justify-start" onClick={() => jsonInput.current.click()}>
              <Upload size={16} /> Import backup (.json)
            </button>
            <input ref={jsonInput} type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files[0]; e.target.value = '';
              if (!f) return;
              try {
                const replace = confirm('Replace ALL current data with this backup?\n\nOK = replace everything\nCancel = merge into current library');
                await importBackup(JSON.parse(await f.text()), { replace });
                flash('ok', `Backup ${replace ? 'restored' : 'merged'}.`);
              } catch (err) { flash('error', err.message); }
            }} />
            <button className="btn-ghost w-full justify-start text-rose-600" disabled={!libCount} onClick={async () => { if (confirm('Delete ALL cards, progress and notes? Export a backup first.')) { await wipeAll(); flash('ok', 'Library cleared.'); } }}>
              <Trash2 size={16} /> Clear library
            </button>
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <div className="text-sm">
              <b>{rows.length}</b> rows · <b>{parsed.topics.length}</b> topics ·{' '}
              <span className={issueCount ? 'text-amber-600' : 'text-emerald-600'}>{issueCount} flagged</span> ·{' '}
              <span title="Same word+POS in several topics becomes one card tagged with all topics">{dupCount} duplicates will merge</span>
            </div>
            <div className="ml-auto flex gap-2">
              <button className="btn-ghost" onClick={() => { setStage('idle'); setRows([]); }}>Cancel</button>
              <button className="btn-primary" onClick={commit}>Import {rows.length} rows</button>
            </div>
          </div>
          {parsed.warnings.length > 0 && (
            <details className="card p-3 text-sm text-amber-700 dark:text-amber-300">
              <summary className="cursor-pointer">{parsed.warnings.length} parser warnings</summary>
              <ul className="mt-2 list-disc pl-5">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <input className="field !w-56" placeholder="Search word / meaning…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            <select className="field !w-64" value={topicFilter} onChange={(e) => { setTopicFilter(e.target.value); setPage(0); }}>
              <option value="">All topics</option>
              {parsed.topics.map((t) => <option key={t.id} value={t.id}>{t.id}. {t.title}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyIssues} onChange={(e) => { setOnlyIssues(e.target.checked); setPage(0); }} /> Flagged only</label>
            <button className="btn-outline ml-auto" onClick={addRow}><Plus size={16} /> Add row</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                <tr><th className="p-2">Topic</th><th className="p-2">Word</th><th className="p-2">POS</th><th className="p-2">IPA</th><th className="p-2">Meaning</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r._id} className={`border-t border-slate-200 dark:border-slate-800 ${r.issues?.length ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                    <td className="p-1.5">
                      <select className="field !py-1" value={r.topicId} onChange={(e) => edit(r._id, { topicId: +e.target.value })} title={topicTitle.get(r.topicId)}>
                        {parsed.topics.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                      </select>
                    </td>
                    {['word', 'pos', 'ipa', 'meaning'].map((f) => (
                      <td key={f} className="p-1.5"><input className={`field !py-1 ${f === 'ipa' ? 'ipa' : ''} ${f === 'pos' ? '!w-24' : ''}`} value={r[f]} onChange={(e) => edit(r._id, { [f]: e.target.value })} /></td>
                    ))}
                    <td className="whitespace-nowrap p-1.5 text-xs text-amber-600">
                      {r.issues?.join(', ')}
                      <button className="btn-ghost !p-1" onClick={() => remove(r._id)} aria-label="Delete row"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-center gap-3 text-sm">
            <button className="btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
            <span>Page {page + 1} / {pages} · {filtered.length} rows</span>
            <button className="btn-outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
