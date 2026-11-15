/**
 * Kshetra - Upgraded Natural Voice & Read-Aloud Engine (Web Speech API v2)
 * Features:
 * - Neural / Online Indian voice prioritization (Microsoft Aarohi/Swara/Madhur, Google Hindi/Marathi, en-IN)
 * - Cross-Devanagari fallback (mr -> hi-IN) so Marathi advisories never silently fail into en-US
 * - Sentence-chunked playback queue eliminating Chrome long-utterance cutoff
 * - Agronomic unit & markdown normalization (°C, mm, ₹, qtl, /100, IPM, KVK)
 * - Persisted user speech preferences (speed, voiceURI, autoSpeak)
 */

export type SpeechLang = "mr" | "hi" | "en";

export interface SpeechPreferences {
  rate: number;
  pitch: number;
  voiceURI: string | null;
  autoSpeak: boolean;
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceURI?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason?: string) => void;
}

export interface RankedVoice {
  voice: SpeechSynthesisVoice;
  label: string;
  isNeural: boolean;
  score: number;
}

const PREFS_KEY = "kshetra_speech_prefs_v2";
const DEFAULT_PREFS: SpeechPreferences = {
  rate: 0.96,
  pitch: 1.03,
  voiceURI: null,
  autoSpeak: false,
};

let activePlaybackToken = 0;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function getSpeechPrefs(): SpeechPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      rate: typeof parsed.rate === "number" ? Math.min(1.3, Math.max(0.75, parsed.rate)) : DEFAULT_PREFS.rate,
      pitch: typeof parsed.pitch === "number" ? Math.min(1.2, Math.max(0.85, parsed.pitch)) : DEFAULT_PREFS.pitch,
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : null,
      autoSpeak: Boolean(parsed.autoSpeak),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setSpeechPrefs(patch: Partial<SpeechPreferences>): SpeechPreferences {
  const next = { ...getSpeechPrefs(), ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors in private mode
    }
  }
  return next;
}

/**
 * Wait briefly for browsers (Chrome/Edge) to populate async speechSynthesis voices.
 */
export function waitForVoices(timeoutMs = 650): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing && existing.length > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    const onVoicesChanged = () => {
      const loaded = window.speechSynthesis.getVoices();
      if (loaded && loaded.length > 0) finish();
    };
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoicesChanged);
    setTimeout(finish, timeoutMs);
  });
}

function scoreVoiceForLang(voice: SpeechSynthesisVoice, lang: SpeechLang, preferredURI?: string | null): number {
  const vLang = (voice.lang || "").toLowerCase().replace("_", "-");
  const vName = (voice.name || "").toLowerCase();
  let score = 0;

  if (preferredURI && voice.voiceURI === preferredURI) {
    score += 200;
  }

  if (lang === "mr") {
    if (vLang === "mr-in" || vLang.startsWith("mr")) score += 120;
    else if (vLang === "hi-in" || vLang.startsWith("hi")) score += 75;
    else if (vLang === "en-in") score += 20;
  } else if (lang === "hi") {
    if (vLang === "hi-in" || vLang.startsWith("hi")) score += 120;
    else if (vLang === "mr-in" || vLang.startsWith("mr")) score += 70;
    else if (vLang === "en-in") score += 20;
  } else {
    if (vLang === "en-in") score += 120;
    else if (vLang === "en-gb") score += 90;
    else if (vLang.startsWith("en")) score += 75;
  }

  // Strongly prioritize neural, natural, and Google/Microsoft Online Indian voices
  if (
    vName.includes("natural") ||
    vName.includes("online") ||
    vName.includes("neural") ||
    vName.includes("wavenet")
  ) {
    score += 60;
  }
  if (
    vName.includes("google") ||
    vName.includes("aarohi") ||
    vName.includes("swara") ||
    vName.includes("madhur") ||
    vName.includes("neerja") ||
    vName.includes("prabhat") ||
    vName.includes("hemant") ||
    vName.includes("kalpana") ||
    vName.includes("lekha")
  ) {
    score += 40;
  }
  if (!voice.localService) {
    score += 20;
  }

  return score;
}

export function getRankedVoicesForLang(voices: SpeechSynthesisVoice[], lang: SpeechLang): RankedVoice[] {
  const prefs = getSpeechPrefs();
  return [...voices]
    .filter((v) => {
      const vl = (v.lang || "").toLowerCase();
      if (lang === "en") return vl.startsWith("en");
      return vl.startsWith("mr") || vl.startsWith("hi") || vl === "en-in";
    })
    .map((voice) => {
      const lower = (voice.name || "").toLowerCase();
      const isNeural =
        lower.includes("natural") ||
        lower.includes("online") ||
        lower.includes("neural") ||
        lower.includes("google");
      const cleanName = voice.name
        .replace(/Microsoft\s+/i, "")
        .replace(/\s*\(Natural\)/i, " (Neural)")
        .replace(/\s+Online/i, "");
      return {
        voice,
        label: `${cleanName} [${voice.lang}]`,
        isNeural,
        score: scoreVoiceForLang(voice, lang, prefs.voiceURI),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: SpeechLang,
  preferredURI?: string | null
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const voice of voices) {
    const sc = scoreVoiceForLang(voice, lang, preferredURI);
    if (sc > bestScore) {
      bestScore = sc;
      best = voice;
    }
  }
  return bestScore > 0 ? best : voices[0];
}

/**
 * Convert formatted markdown advisory text into natural, warm spoken sentences.
 */
export function formatTextForSpeech(text: string, lang: SpeechLang = "mr"): string {
  if (!text) return "";

  const unitMap = {
    mr: {
      degC: " अंश सेल्सिअस",
      mm: " मिलीमीटर",
      kmh: " किलोमीटर प्रति तास",
      qtl: " क्विंटल",
      rupees: " रुपये",
      outOf100: "$1, शंभर पैकी गुण",
      ipm: "एकात्मिक कीड व्यवस्थापन",
      kvk: "कृषी विज्ञान केंद्र",
      ac: " एकर",
    },
    hi: {
      degC: " डिग्री सेल्सियस",
      mm: " मिलीमीटर",
      kmh: " किलोमीटर प्रति घंटा",
      qtl: " क्विंटल",
      rupees: " रुपये",
      outOf100: "$1, सौ में से अंक",
      ipm: "समग्र कीट प्रबंधन",
      kvk: "कृषि विज्ञान केंद्र",
      ac: " एकड़",
    },
    en: {
      degC: " degrees Celsius",
      mm: " millimeters",
      kmh: " kilometers per hour",
      qtl: " quintal",
      rupees: " rupees",
      outOf100: "$1 out of 100",
      ipm: "integrated pest management",
      kvk: "Krishi Vigyan Kendra",
      ac: " acres",
    },
  }[lang];

  let out = text
    // Replace markdown links [label](url) with just label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Strip markdown heading hashes, bold/italic markers, code ticks, blockquotes
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/[*_`~]/g, "")
    // Convert bullet prefixes into natural line pauses
    .replace(/^\s*[-•]\s+/gm, "")
    // Expand numeric & agronomic symbols
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*100\b/g, unitMap.outOf100)
    .replace(/°\s*C/gi, unitMap.degC)
    .replace(/\bkm\/h\b/gi, unitMap.kmh)
    .replace(/\bm³\/m³\b/gi, "")
    .replace(/\/qtl\b|\bqtl\b/gi, unitMap.qtl)
    .replace(/\bmm\b/gi, unitMap.mm)
    .replace(/\bac\b/gi, unitMap.ac)
    .replace(/₹\s*(\d+(?:[.,]\d+)?)/g, `$1${unitMap.rupees}`)
    .replace(/\bIPM\b/g, unitMap.ipm)
    .replace(/\bKVK\b/g, unitMap.kvk)
    // Turn visual dividers (pipes, middots, em-dashes, multiple spaces) into gentle comma pauses
    .replace(/\s*[|•—]+\s*/g, ", ")
    .replace(/:\s*/g, ": ")
    // Ensure newlines conclude sentences cleanly
    .replace(/\n{2,}/g, "। ")
    .replace(/\n/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (lang === "en") {
    out = out.replace(/।/g, ".");
  }
  return out;
}

/**
 * Split long responses into <= 175 char sentence chunks so browsers never drop mid-speech.
 */
function splitIntoNaturalChunks(cleanText: string, maxLen = 175): string[] {
  if (!cleanText) return [];
  const rawSentences = cleanText
    .split(/(?<=[।.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of rawSentences) {
    if (sentence.length > maxLen) {
      if (buffer) {
        chunks.push(buffer);
        buffer = "";
      }
      const subParts = sentence.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
      let subBuf = "";
      for (const part of subParts) {
        if ((subBuf ? `${subBuf}, ${part}` : part).length <= maxLen) {
          subBuf = subBuf ? `${subBuf}, ${part}` : part;
        } else {
          if (subBuf) chunks.push(subBuf);
          subBuf = part;
        }
      }
      if (subBuf) chunks.push(subBuf);
      continue;
    }

    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length <= maxLen) {
      buffer = candidate;
    } else {
      if (buffer) chunks.push(buffer);
      buffer = sentence;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export async function speakText(
  text: string,
  lang: SpeechLang = "mr",
  options: SpeakOptions = {}
): Promise<void> {
  if (!isSpeechSynthesisSupported()) {
    console.warn("Speech synthesis not supported in this browser.");
    options.onError?.("not_supported");
    return;
  }

  activePlaybackToken += 1;
  const myToken = activePlaybackToken;
  window.speechSynthesis.cancel();

  const normalized = formatTextForSpeech(text, lang);
  const chunks = splitIntoNaturalChunks(normalized);
  if (chunks.length === 0) {
    options.onEnd?.();
    return;
  }

  const prefs = getSpeechPrefs();
  const rate = options.rate ?? prefs.rate;
  const pitch = options.pitch ?? prefs.pitch;
  const preferredURI = options.voiceURI ?? prefs.voiceURI;

  const voices = await waitForVoices();
  if (myToken !== activePlaybackToken) return;

  const bestVoice = selectBestVoice(voices, lang, preferredURI);
  const langMap: Record<SpeechLang, string> = {
    mr: "mr-IN",
    hi: "hi-IN",
    en: "en-IN",
  };
  const resolvedLang = bestVoice?.lang || langMap[lang] || "mr-IN";

  options.onStart?.();

  let index = 0;
  const speakNext = () => {
    if (myToken !== activePlaybackToken) return;
    if (index >= chunks.length) {
      options.onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.lang = resolvedLang;
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => {
      if (myToken !== activePlaybackToken) return;
      index += 1;
      speakNext();
    };
    utterance.onerror = (ev) => {
      if (myToken !== activePlaybackToken) return;
      // Ignore intentional cancellation errors triggered by stopSpeaking
      if (ev.error === "canceled" || ev.error === "interrupted") return;
      options.onError?.(ev.error || "speech_error");
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}

export function stopSpeaking(): void {
  activePlaybackToken += 1;
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
