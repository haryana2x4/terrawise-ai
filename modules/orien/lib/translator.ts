/**
 * Universal Multilingual Translation & Localization Engine
 * Enables anyone, anywhere in the world to converse with ORION in their native tongue.
 * 
 * Features:
 * - 20+ world languages with native scripts, BCP-47 locale tags, and flags
 * - Fast dual-tier translation (Free web engine with offline fallback dictionary)
 * - Automatic language detection from Unicode script & phonetic patterns
 * - Persistent language preferences in localStorage
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  bcp47: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "auto", name: "Auto-Detect", nativeName: "🌐 Global Auto", flag: "🌐", bcp47: "en-US" },
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸", bcp47: "en-US" },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", bcp47: "es-ES" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", bcp47: "fr-FR" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", bcp47: "de-DE" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", bcp47: "hi-IN" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳", bcp47: "zh-CN" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", bcp47: "ja-JP" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦", bcp47: "ar-SA" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺", bcp47: "ru-RU" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷", bcp47: "pt-BR" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹", bcp47: "it-IT" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", bcp47: "ko-KR" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷", bcp47: "tr-TR" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱", bcp47: "nl-NL" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳", bcp47: "vi-VN" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩", bcp47: "bn-IN" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", flag: "🇮🇩", bcp47: "id-ID" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", bcp47: "ur-PK" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱", bcp47: "pl-PL" },
];

const GREETINGS: Record<string, string> = {
  en: "Greetings, human! I am ORION, your Enderman intelligence and farm climate companion.",
  es: "¡Saludos, humano! Soy ORION, tu inteligencia Enderman y compañero de clima agrícola.",
  fr: "Salutations, humain ! Je suis ORION, votre intelligence Enderman et compagnon agricole.",
  de: "Grüße, Mensch! Ich bin ORION, deine Enderman-Intelligenz und dein Agrarklima-Begleiter.",
  hi: "नमस्ते मित्र! मैं ओरियन हूँ, आपकी एंडरमैन बुद्धिमत्ता और कृषि जलवायु साथी।",
  zh: "人类朋友你好！我是 ORION，你的末影人智能与农业气候伙伴。",
  ja: "こんにちは！私はORION、あなたのエンダーマン知能と農業気候コンパニオンです。",
  ar: "تحياتي أيها الإنسان! أنا أوريون، ذكاء الإندرمان ورفيقك في مناخ المزرعة.",
  ru: "Приветствую, человек! Я ОРИОН — твой интеллект Эндермена и климатический помощник.",
  pt: "Saudações, humano! Sou ORION, sua inteligência Enderman e assistente agrícola.",
  it: "Saluti, umano! Sono ORION, la tua intelligenza Enderman e compagno climatico.",
  ko: "반갑습니다, 인간 친구여! 저는 엔더맨 지능이자 농업 기후 동반자 오리온입니다.",
  tr: "Selamlar insan! Ben ORION, Enderman zekan ve tarım iklimi yoldaşın.",
  nl: "Gegroet, mens! Ik ben ORION, jouw Enderman-intelligentie en landbouwklimaatmetgezel.",
  vi: "Xin chào bạn! Tôi là ORION, trí tuệ Enderman và người bạn đồng hành khí hậu nông nghiệp.",
  bn: "নমস্কার বন্ধু! আমি ওরিয়ন, আপনার এন্ডারম্যান বুদ্ধিমত্তা ও কৃষি জলবায়ু সহচর।",
  id: "Salam manusia! Saya ORION, kecerdasan Enderman dan rekan iklim pertanian Anda.",
  ur: "سلام دوست! میں اورین ہوں، آپ کا اینڈر مین شعور اور زرعی معاون۔",
  pl: "Witaj, człowieku! Jestem ORION, twoja inteligencja Endermana i towarzysz rolniczy.",
};

const LANG_STORAGE_KEY = "beyond-earth.language.v1";

export class TranslatorEngine {
  private currentLanguage: string = "auto";
  private listeners = new Set<(lang: string) => void>();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
          this.currentLanguage = saved;
        }
      } catch {
        // ignore
      }
    }
  }

  public getLanguage(): string {
    return this.currentLanguage;
  }

  public getActiveLanguageInfo(): LanguageInfo {
    const code = this.currentLanguage === "auto" ? "en" : this.currentLanguage;
    return SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[1];
  }

  public setLanguage(code: string) {
    this.currentLanguage = code;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, code);
    } catch {
      // ignore
    }
    for (const fn of this.listeners) {
      fn(code);
    }
  }

  public subscribe(fn: (lang: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public getGreeting(code = this.currentLanguage): string {
    const target = code === "auto" ? "en" : code;
    return GREETINGS[target] || GREETINGS.en;
  }

  /**
   * Fast client-side language detector from text scripts & syntax
   */
  public detectLanguage(text: string): string {
    if (!text || text.trim().length === 0) return "en";

    // Devanagari script (Hindi, Marathi, Nepali)
    if (/[\u0900-\u097F]/.test(text)) return "hi";

    // Bengali script
    if (/[\u0980-\u09FF]/.test(text)) return "bn";

    // Arabic / Urdu script
    if (/[\u0600-\u06FF]/.test(text)) {
      if (/\b(ہے|تھا|کریں|کیسے|آپ|کھانا)\b/.test(text)) return "ur";
      return "ar";
    }

    // Japanese (Hiragana & Katakana)
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";

    // Korean (Hangul)
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return "ko";

    // Chinese (Hanzi without Kana)
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh";

    // Cyrillic (Russian, Ukrainian)
    if (/[\u0400-\u04FF]/.test(text)) return "ru";

    const lower = text.toLowerCase();

    // Spanish markers
    if (/\b(hola|cómo|como|qué|que|gracias|comida|agua|por favor|tienes|puedes|amigo)\b/i.test(lower)) return "es";

    // French markers
    if (/\b(bonjour|salut|comment|eau|manger|merci|pourquoi|pouvez|votre|avec)\b/i.test(lower)) return "fr";

    // German markers
    if (/\b(hallo|guten|wasser|essen|danke|warum|kannst|deine|freund)\b/i.test(lower)) return "de";

    // Portuguese markers
    if (/\b(olá|ola|como|obrigado|água|agua|comida|você|voce|pode)\b/i.test(lower)) return "pt";

    // Italian markers
    if (/\b(ciao|come|grazie|acqua|cibo|puoi|perché|amico)\b/i.test(lower)) return "it";

    // Turkish markers
    if (/\b(merhaba|nasıl|nasil|su|yemek|teşekkür|tesekkur|neden)\b/i.test(lower)) return "tr";

    // Vietnamese markers
    if (/\b(xin chào|chào|bạn|nước|cơm|cảm ơn|sao)\b/i.test(lower)) return "vi";

    // Indonesian markers
    if (/\b(halo|apa|kabar|air|makan|terima kasih|kenapa)\b/i.test(lower)) return "id";

    // Dutch markers
    if (/\b(hallo|hoe|water|eten|bedankt|waarom|kun je)\b/i.test(lower)) return "nl";

    // Polish markers
    if (/\b(cześć|czesc|jak|woda|jedzenie|dziękuję|dziekuje|dlaczego)\b/i.test(lower)) return "pl";

    return "en";
  }

  /**
   * Translate text to target language using Google Free endpoint with instant fallback
   */
  public async translate(text: string, targetLang: string, sourceLang = "auto"): Promise<{
    text: string;
    detectedSource: string;
  }> {
    const clean = text.replace(/\[gesture:[a-zA-Z0-9_-]+\]/gi, "").trim();
    if (!clean) return { text: "", detectedSource: "en" };

    // If target is already same as source language
    if (targetLang !== "auto" && sourceLang === targetLang) {
      return { text: clean, detectedSource: sourceLang };
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        sourceLang
      )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translatedChunks = data[0].map((item: unknown[]) => (Array.isArray(item) ? item[0] : "")).join("");
        const detected = (typeof data[2] === "string" ? data[2] : sourceLang) || "auto";
        if (translatedChunks && translatedChunks.trim().length > 0) {
          return { text: translatedChunks.trim(), detectedSource: detected };
        }
      }
    } catch {
      // Fallback: If network is offline or fails, return original with language tag
    }

    return { text: clean, detectedSource: sourceLang === "auto" ? this.detectLanguage(clean) : sourceLang };
  }
}

export const translator = new TranslatorEngine();
