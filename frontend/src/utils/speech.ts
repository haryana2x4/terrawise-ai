/**
 * Kshetra - Voice Read-Aloud Utility (Web Speech API)
 * Enables farmers and children to listen to daily agricultural guidance in Marathi or Hindi.
 */

export function speakText(text: string, lang: "mr" | "hi" | "en" = "mr") {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel(); // Stop any ongoing speech

  const cleanText = text.replace(/[*#_]/g, "");
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.9; // Slightly slower, calm cadence for clear comprehension
  utterance.pitch = 1.0;

  // Language codes
  const langMap: Record<string, string> = {
    mr: "mr-IN",
    hi: "hi-IN",
    en: "en-IN"
  };
  utterance.lang = langMap[lang] || "mr-IN";

  // Try to find matching voice
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(v => v.lang.startsWith(lang) || v.lang === langMap[lang]);
  if (match) {
    utterance.voice = match;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
