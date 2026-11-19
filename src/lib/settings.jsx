import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'vocab.settings';
const DEFAULTS = {
  theme: 'system', // system | light | dark
  accent: 'us', // us | uk
  voiceURI: '',
  autoplay: true,
  speed: 1, // 1 | 0.75
  mode: 'cloze', // cloze | dictation | quiz
  sessionSize: 20,
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

const Ctx = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings]);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
