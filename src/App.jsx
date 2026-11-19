import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, GraduationCap, LayoutDashboard, FileUp, Moon, Sun, Monitor, Loader2 } from 'lucide-react';
import { db } from './lib/db.js';
import { useSettings } from './lib/settings.jsx';
import { subscribeEnrich } from './lib/enrich.js';
import { loadVoices } from './lib/speech.js';
import { boot } from './lib/boot.js';
import SyncBadge from './components/SyncBadge.jsx';
import Dashboard from './components/Dashboard.jsx';
import StudyView from './components/StudyView.jsx';
import DictionaryView from './components/DictionaryView.jsx';
import ImportView from './components/ImportView.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'study', label: 'Study', icon: GraduationCap },
  { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
  { id: 'import', label: 'Import', icon: FileUp },
];

export default function App() {
  const [view, setView] = useState('dashboard');
  const [studyScope, setStudyScope] = useState(null);
  const { settings, update } = useSettings();
  const count = useLiveQuery(() => db.words.count(), []);
  const [enrich, setEnrich] = useState({ pending: 0, active: false, paused: false });

  useEffect(() => subscribeEnrich(setEnrich), []);
  useEffect(() => {
    loadVoices();
    boot().catch((e) => console.warn('boot failed', e));
  }, []);

  const go = (v, scope = null) => {
    setStudyScope(scope);
    setView(v);
  };
  const nextTheme = { system: 'light', light: 'dark', dark: 'system' }[settings.theme];
  const ThemeIcon = { system: Monitor, light: Sun, dark: Moon }[settings.theme];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          <div className="mr-2 flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">V</span>
            <span className="hidden sm:inline">Vocab Memory</span>
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => go(id)}
                className={`btn !px-3 ${view === id ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'btn-ghost'}`}>
                <Icon size={16} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
          {(enrich.pending > 0 || enrich.active) && (
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex" title="Fetching IPA, audio and examples (max 2 requests/sec)">
              <Loader2 size={13} className="animate-spin" /> {enrich.paused ? 'rate-limit pause' : `enriching ${enrich.pending}`}
            </span>
          )}
          <SyncBadge />
          <button className="btn-ghost !p-2" onClick={() => update({ theme: nextTheme })} title={`Theme: ${settings.theme}`} aria-label="Toggle theme">
            <ThemeIcon size={18} />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {view === 'dashboard' && <Dashboard go={go} wordCount={count} />}
        {view === 'study' && <StudyView initialScope={studyScope} go={go} />}
        {view === 'dictionary' && <DictionaryView />}
        {view === 'import' && <ImportView go={go} />}
      </main>
    </div>
  );
}
