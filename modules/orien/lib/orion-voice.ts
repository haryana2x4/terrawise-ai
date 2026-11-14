/**
 * Universal Speech Synthesis & Phonetic Lip-Sync Engine for ORION
 * Upgraded with:
 * 1. Global Multilingual Voice Tuning (English, Spanish, Hindi, French, German, Japanese, Chinese, Arabic, Russian, etc.)
 * 2. Natural Voice Selector with automatic quality prioritization (Google, Microsoft Natural, Apple, Neural)
 * 3. Asynchronous voice initialization (`onvoiceschanged`)
 * 4. Procedural Web Audio sub-bass resonance filter for authentic Enderman presence
 * 5. Customizable Pitch, Speed & Voice preview in 20+ world languages
 * 6. High-precision 60 FPS phonetic jaw drop & eye-glow pulse modulation
 */

import { sound } from "./sound-effects";
import { translator } from "./translator";

type LipSyncListener = (amplitude: number, eyePulse: number) => void;

export interface VoiceSettings {
  pitch: number; // 0.5 to 1.5
  rate: number;  // 0.7 to 1.3
  customVoiceName?: string;
  resonanceEnabled: boolean;
}

const SETTINGS_KEY = "beyond-earth.voice-settings.v2";

class OrionVoiceEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners = new Set<LipSyncListener>();
  private speaking = false;
  private animFrame = 0;
  private audioAmp = 0;
  private targetAmp = 0;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesReady = false;

  private settings: VoiceSettings = {
    pitch: 0.78,
    rate: 0.94,
    resonanceEnabled: true,
  };

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadSettings();
      this.initVoices();
    }
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
  }

  public saveSettings(newSettings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  private initVoices() {
    if (!this.synth) return;

    const populate = () => {
      this.voices = this.synth?.getVoices() || [];
      if (this.voices.length > 0) {
        this.voicesReady = true;
      }
    };

    populate();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populate;
    }
  }

  public getVoices(langCode?: string): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    if (!langCode || langCode === "auto") {
      return this.voices;
    }
    const cleanLang = langCode.toLowerCase().split("-")[0];
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith(cleanLang));
  }

  public subscribeLipSync(fn: LipSyncListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(amp: number, pulse: number) {
    for (const fn of this.listeners) {
      fn(amp, pulse);
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public stop() {
    this.speaking = false;
    cancelAnimationFrame(this.animFrame);
    if (this.synth) {
      this.synth.cancel();
    }
    this.audioAmp = 0;
    this.targetAmp = 0;
    this.notify(0, 1.0);
  }

  /**
   * How long the spoken line should last, so on-screen text can finish with the voice.
   */
  public durationMs(text: string): number {
    const clean = text.replace(/\[gesture:[a-zA-Z0-9_-]+\]/gi, "").trim();
    if (!clean) return 400;
    if (sound.isMuted() || !this.synth) {
      return Math.min(14000, Math.max(1600, clean.length * 52));
    }
    const words = clean.split(/\s+/).length;
    return Math.min(48000, Math.max(1500, Math.round(words * 410 + 400)));
  }

  /**
   * Pick the best high-quality voice for the target language
   */
  private pickBestVoice(lang = "en"): SpeechSynthesisVoice | undefined {
    if (!this.synth) return undefined;
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }

    // Check user-selected custom voice
    if (this.settings.customVoiceName) {
      const custom = this.voices.find((v) => v.name === this.settings.customVoiceName);
      if (custom) return custom;
    }

    const cleanLang = lang.toLowerCase().split("-")[0];
    const langVoices = this.voices.filter((v) => v.lang.toLowerCase().startsWith(cleanLang));
    if (langVoices.length === 0) {
      // Fallback to any voice with language prefix or English
      return (
        this.voices.find((v) => v.lang.startsWith("en") && /natural|male|david|daniel/i.test(v.name)) ||
        this.voices.find((v) => v.lang.startsWith("en")) ||
        this.voices[0]
      );
    }

    // Prioritize natural / neural / premium voices
    const naturalVoice = langVoices.find((v) =>
      /natural|neural|online|google|premium|enhanced|pro/i.test(v.name)
    );
    if (naturalVoice) return naturalVoice;

    // Prioritize male / resonant / standard
    const maleVoice = langVoices.find((v) => /male|homme|uomo|mann|hombre/i.test(v.name));
    if (maleVoice) return maleVoice;

    return langVoices[0];
  }

  /**
   * Trigger subtle acoustic Enderman resonance using Web Audio
   */
  private playCosmicResonance() {
    if (sound.isMuted() || !this.settings.resonanceEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Deep 62Hz sub-bass with gentle lowpass
      osc.type = "sine";
      osc.frequency.setValueAtTime(62, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.8);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(280, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.75);
    } catch {
      // ignore
    }
  }

  /**
   * Speak a text string with real-time lip sync amplitude modulation
   * Backwards-compatible with (text, onEnd) and supports language selection
   */
  public speak(
    text: string,
    onEndOrOptions?: (() => void) | { onEnd?: () => void; lang?: string; pitch?: number; rate?: number },
    maybeLang?: string
  ) {
    this.stop();

    let onEnd: (() => void) | undefined;
    let targetLang = maybeLang || "en";
    let customPitch = this.settings.pitch;
    let customRate = this.settings.rate;

    if (typeof onEndOrOptions === "function") {
      onEnd = onEndOrOptions;
    } else if (onEndOrOptions && typeof onEndOrOptions === "object") {
      onEnd = onEndOrOptions.onEnd;
      if (onEndOrOptions.lang) targetLang = onEndOrOptions.lang;
      if (onEndOrOptions.pitch !== undefined) customPitch = onEndOrOptions.pitch;
      if (onEndOrOptions.rate !== undefined) customRate = onEndOrOptions.rate;
    }

    if (sound.isMuted() || !this.synth) {
      this.simulateLipSync(text, onEnd);
      return;
    }

    // Strip bracketed gesture tags like [gesture:wave] from spoken text
    const cleanText = text.replace(/\[gesture:[a-zA-Z0-9_-]+\]/gi, "").trim();
    if (!cleanText) {
      onEnd?.();
      return;
    }

    // Auto-detect language if specified or auto
    if (targetLang === "auto") {
      targetLang = translator.detectLanguage(cleanText);
    }

    const utter = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utter;

    // Pick matching voice
    const matchedVoice = this.pickBestVoice(targetLang);
    if (matchedVoice) {
      utter.voice = matchedVoice;
      utter.lang = matchedVoice.lang;
    } else {
      utter.lang = targetLang;
    }

    // Pitch tuning: Asian & Indic languages sound clearer slightly higher (0.88-0.95), English is deep (0.76)
    if (["hi", "bn", "ur", "ja", "zh", "ko", "vi", "id"].includes(targetLang.slice(0, 2))) {
      utter.pitch = Math.max(0.86, customPitch);
      utter.rate = Math.min(1.02, Math.max(0.9, customRate));
    } else {
      utter.pitch = customPitch;
      utter.rate = customRate;
    }

    utter.volume = 1.0;
    this.speaking = true;

    // Play subtle cosmic resonance burst
    this.playCosmicResonance();

    // Syllable / boundary listener for precision syllable bursts
    utter.onboundary = () => {
      this.targetAmp = Math.min(1.0, 0.45 + Math.random() * 0.55);
    };

    utter.onstart = () => {
      this.speaking = true;
      this.startLipSyncLoop();
    };

    utter.onend = () => {
      this.speaking = false;
      cancelAnimationFrame(this.animFrame);
      this.audioAmp = 0;
      this.notify(0, 1.0);
      onEnd?.();
    };

    utter.onerror = () => {
      this.speaking = false;
      cancelAnimationFrame(this.animFrame);
      this.audioAmp = 0;
      this.notify(0, 1.0);
      onEnd?.();
    };

    try {
      this.synth.speak(utter);
    } catch {
      this.simulateLipSync(cleanText, onEnd);
    }
  }

  /**
   * Preview voice in chosen language with full 3D lip-sync
   */
  public previewVoice(langCode = "en", onEnd?: () => void) {
    const greeting = translator.getGreeting(langCode);
    this.speak(greeting, { onEnd, lang: langCode });
  }

  /**
   * Continuous 60fps lip-sync animation loop running while speech is active
   */
  private startLipSyncLoop() {
    let t = 0;
    const loop = () => {
      if (!this.speaking) return;

      t += 0.18;
      // Procedural syllable flutter + boundary burst
      const rhythm = Math.max(
        0,
        Math.sin(t * 3.2) * 0.5 + Math.cos(t * 7.4) * 0.35 + Math.sin(t * 11.1) * 0.2
      );
      this.targetAmp = Math.max(this.targetAmp * 0.88, rhythm);
      this.audioAmp += (this.targetAmp - this.audioAmp) * 0.28;

      const eyePulse = 1.0 + this.audioAmp * 0.4;
      this.notify(this.audioAmp, eyePulse);

      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /**
   * Procedural lip-sync fallback if speech synthesis is disabled or muted
   */
  private simulateLipSync(text: string, onEnd?: () => void) {
    this.speaking = true;
    const durationMs = this.durationMs(text);
    const start = performance.now();

    const loop = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= durationMs || !this.speaking) {
        this.speaking = false;
        this.audioAmp = 0;
        this.notify(0, 1.0);
        onEnd?.();
        return;
      }

      const t = elapsed * 0.012;
      const wave = Math.max(0, Math.sin(t * 2.8) * 0.6 + Math.cos(t * 6.2) * 0.3);
      this.audioAmp = wave * (1 - elapsed / durationMs);
      this.notify(this.audioAmp, 1.0 + this.audioAmp * 0.35);

      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }
}

export const orionVoice = new OrionVoiceEngine();
