// Pronunciation: dictionary-API audio when we have it, otherwise offline speechSynthesis.
let voicesCache = [];

export function loadVoices() {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve([]);
    const get = () => {
      voicesCache = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
      return voicesCache;
    };
    const v = get();
    if (v.length) return resolve(v);
    speechSynthesis.addEventListener('voiceschanged', () => resolve(get()), { once: true });
    setTimeout(() => resolve(get()), 1200);
  });
}

export function pickVoice(accent, voiceURI) {
  if (voiceURI) {
    const exact = voicesCache.find((v) => v.voiceURI === voiceURI);
    if (exact) return exact;
  }
  const lang = accent === 'uk' ? /^en[-_]GB/i : /^en[-_]US/i;
  return voicesCache.find((v) => lang.test(v.lang)) || voicesCache[0] || null;
}

let currentAudio = null;

export function stopSpeech() {
  try {
    speechSynthesis.cancel();
  } catch {
    /* noop */
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function tts(text, { accent, voiceURI, rate }) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(accent, voiceURI);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
  u.rate = rate;
  speechSynthesis.speak(u);
}

/** Speak `word`; prefers a real recording matching the accent when available. */
export function speak(word, { accent = 'us', voiceURI = '', rate = 1 } = {}) {
  stopSpeech();
  const url = accent === 'uk' ? word.audioUk || word.audioUs : word.audioUs || word.audioUk;
  const accentOk = accent === 'uk' ? !!word.audioUk : !!word.audioUs;
  if (url && accentOk) {
    const a = new Audio(url);
    a.playbackRate = rate;
    currentAudio = a;
    a.play().catch(() => tts(word.word, { accent, voiceURI, rate }));
    return;
  }
  tts(word.word, { accent, voiceURI, rate });
}
