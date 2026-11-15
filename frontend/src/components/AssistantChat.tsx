import React, { useEffect, useRef, useState } from "react";
import { Language } from "../i18n/translations";
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  X,
  Sparkles,
  ShieldAlert,
  Languages,
  SlidersHorizontal,
  Play
} from "lucide-react";
import {
  getRankedVoicesForLang,
  getSpeechPrefs,
  RankedVoice,
  setSpeechPrefs,
  speakText,
  stopSpeaking,
  waitForVoices
} from "../utils/speech";

interface AssistantChatProps {
  token: string;
  farmer: any;
  activeParcel: any;
  lang: Language;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  language: string;
  provider?: string;
  feedback_rating?: number | null;
  created_at?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSafeMarkdown(text: string): string {
  const escaped = escapeHtml(text || "");
  return escaped
    .replace(/^###\s+(.+)$/gm, '<h4 class="font-extrabold text-emerald-950 text-sm mt-2 mb-1">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /^&gt;\s+(.+)$/gm,
      '<blockquote class="border-l-4 border-amber-500 bg-amber-50/80 pl-2.5 py-1 my-1.5 text-xs text-amber-950 font-medium rounded-r">$1</blockquote>'
    )
    .replace(/^-\s+(.+)$/gm, '<li class="ml-4 list-disc text-xs sm:text-sm my-0.5">$1</li>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function normalizeLangCode(code?: string | null): Language {
  const short = (code || "mr").toLowerCase().slice(0, 2);
  if (short === "hi" || short === "en" || short === "mr") return short;
  return "mr";
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  token,
  farmer,
  activeParcel,
  lang,
  onClose
}) => {
  const initialPrefs = getSpeechPrefs();

  const [chatLang, setChatLang] = useState<Language>(lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Voice settings state
  const [autoSpeak, setAutoSpeak] = useState<boolean>(initialPrefs.autoSpeak);
  const [speechRate, setSpeechRate] = useState<number>(initialPrefs.rate);
  const [voiceURI, setVoiceURI] = useState<string | null>(initialPrefs.voiceURI);
  const [rankedVoices, setRankedVoices] = useState<RankedVoice[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  // Per-message translation state
  const [translatedCache, setTranslatedCache] = useState<
    Record<number, Partial<Record<Language, { text: string; provider: string }>>>
  >({});
  const [activeMsgLang, setActiveMsgLang] = useState<Record<number, Language>>({});
  const [translatingMsgId, setTranslatingMsgId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setChatLang(lang);
  }, [lang]);

  useEffect(() => {
    let active = true;
    waitForVoices().then((allVoices) => {
      if (!active) return;
      setRankedVoices(getRankedVoicesForLang(allVoices, chatLang));
    });
    return () => {
      active = false;
    };
  }, [chatLang]);

  const quickChips = {
    mr: [
      "माझ्या शेतात या हंगामात कोणते पीक घ्यावे?",
      "पुढील ७ दिवसांचा पाऊस आणि पाणी नियोजन सांगा",
      "मातीतील ओलावा आणि बाष्पीभवन (VPD) स्थिती काय आहे?",
      "पिकावरील कीड व रोगांसाठी एकात्मिक व्यवस्थापन (IPM) सांगा"
    ],
    hi: [
      "मेरे खेत में इस मौसम में कौन सी फसल बोनी चाहिए?",
      "अगले 7 दिनों की बारिश और सिंचाई योजना बताएं",
      "मिट्टी की नमी और वाष्पीकरण (VPD) की स्थिति क्या है?",
      "फसल में कीट एवं रोग के लिए समग्र प्रबंधन (IPM) बताएं"
    ],
    en: [
      "Which crop has the highest suitability score for my parcel?",
      "What is the 7-day rainfall forecast and irrigation plan?",
      "Explain my field's soil moisture and VPD status",
      "Recommend IPM pest precautions for my field"
    ]
  }[chatLang];

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const resp = await fetch("/api/v1/assistant/history", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          setMessages(data.messages || []);
        }
      } catch {
        // Ignore network error on initial load
      }
    };
    fetchHistory();
    return () => {
      stopSpeaking();
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore
      }
    };
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const speakMessageContent = (msgId: number, content: string, msgLang: Language) => {
    setSpeakingId(msgId);
    void speakText(content, msgLang, {
      rate: speechRate,
      voiceURI,
      onStart: () => setSpeakingId(msgId),
      onEnd: () => setSpeakingId((cur) => (cur === msgId ? null : cur)),
      onError: () => setSpeakingId((cur) => (cur === msgId ? null : cur))
    });
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setErrorBanner(null);
    setIsSending(true);
    setInputText("");

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: trimmed,
      language: chatLang
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const resp = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: trimmed,
          language: chatLang,
          parcel_id: activeParcel?.id ?? null
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Assistant request failed");
      }
      if (data.message) {
        const assistantMsg: ChatMessage = data.message;
        setMessages((prev) => [...prev, assistantMsg]);
        if (autoSpeak) {
          speakMessageContent(
            assistantMsg.id,
            assistantMsg.content,
            normalizeLangCode(assistantMsg.language || chatLang)
          );
        }
      }
    } catch (err: any) {
      setErrorBanner(
        err.message ||
          (chatLang === "mr"
            ? "कृषी मित्र सहाय्यकाशी संपर्क साधता आला नाही."
            : chatLang === "hi"
              ? "कृषि मित्र सहायक से संपर्क नहीं हो सका।"
              : "Could not reach Krishi Mitra assistant.")
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    stopSpeaking();
    setSpeakingId(null);
    try {
      const resp = await fetch("/api/v1/assistant/history", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setMessages([]);
        setTranslatedCache({});
        setActiveMsgLang({});
      }
    } catch {
      // Ignore
    }
  };

  const handleFeedback = async (msgId: number, rating: 1 | -1) => {
    try {
      const resp = await fetch("/api/v1/assistant/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message_id: msgId, rating })
      });
      if (resp.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, feedback_rating: rating } : m))
        );
      }
    } catch {
      // Ignore
    }
  };

  const handleVoiceInput = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorBanner(
        chatLang === "mr"
          ? "तुमच्या ब्राउझरमध्ये व्हॉइस टायपिंग उपलब्ध नाही. कृपया Chrome किंवा Edge वापरा."
          : chatLang === "hi"
            ? "आपके ब्राउज़र में वॉइस टाइपिंग उपलब्ध नहीं है। कृपया Chrome या Edge का उपयोग करें।"
            : "Voice recognition is not supported in this browser. Please use Chrome or Edge."
      );
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognitionRef.current = recognition;
    recognition.lang = chatLang === "mr" ? "mr-IN" : chatLang === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInputText(transcript);
      }
    };
    recognition.start();
  };

  const getDisplayedMessage = (msg: ChatMessage): { text: string; displayLang: Language } => {
    const originalLang = normalizeLangCode(msg.language);
    const desiredLang = activeMsgLang[msg.id] || originalLang;
    if (desiredLang === originalLang) {
      return { text: msg.content, displayLang: originalLang };
    }
    const cached = translatedCache[msg.id]?.[desiredLang];
    if (cached) {
      return { text: cached.text, displayLang: desiredLang };
    }
    return { text: msg.content, displayLang: originalLang };
  };

  const handleTranslateMessage = async (msg: ChatMessage, targetLang: Language) => {
    const originalLang = normalizeLangCode(msg.language);
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
    }

    if (targetLang === originalLang || translatedCache[msg.id]?.[targetLang]) {
      setActiveMsgLang((prev) => ({ ...prev, [msg.id]: targetLang }));
      return;
    }

    setTranslatingMsgId(msg.id);
    setErrorBanner(null);
    try {
      const resp = await fetch("/api/v1/assistant/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message_id: msg.id,
          text: msg.content,
          source_lang: originalLang,
          target_lang: targetLang
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || "Translation failed");
      }
      setTranslatedCache((prev) => ({
        ...prev,
        [msg.id]: {
          ...(prev[msg.id] || {}),
          [targetLang]: {
            text: data.translated_text || msg.content,
            provider: data.provider || "kshetra-translator"
          }
        }
      }));
      setActiveMsgLang((prev) => ({ ...prev, [msg.id]: targetLang }));
    } catch (err: any) {
      setErrorBanner(
        err.message ||
          (chatLang === "mr"
            ? "भाषांतर करता आले नाही."
            : chatLang === "hi"
              ? "अनुवाद पूरा नहीं हो सका।"
              : "Could not translate this message.")
      );
    } finally {
      setTranslatingMsgId(null);
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      const { text, displayLang } = getDisplayedMessage(msg);
      speakMessageContent(msg.id, text, displayLang);
    }
  };

  const handleToggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    setSpeechPrefs({ autoSpeak: next });
  };

  const handleRateChange = (nextRate: number) => {
    setSpeechRate(nextRate);
    setSpeechPrefs({ rate: nextRate });
  };

  const handleVoiceChange = (nextURI: string) => {
    const val = nextURI || null;
    setVoiceURI(val);
    setSpeechPrefs({ voiceURI: val });
  };

  const handleTestVoice = () => {
    const sampleLine =
      chatLang === "mr"
        ? "नमस्कार शेतकरी बंधू! मी क्षेत्र कृषी मित्र बोलत आहे. तुमचा शेताचा सल्ला तयार आहे."
        : chatLang === "hi"
          ? "नमस्ते किसान भाई! मैं क्षेत्र कृषि मित्र बोल रहा हूँ। आपकी खेत की सलाह तैयार है।"
          : "Hello! I am Kshetra Krishi Mitra. Your personalized farm advisory voice is ready.";
    void speakText(sampleLine, chatLang, { rate: speechRate, voiceURI });
  };

  const speakLabel = (displayLang: Language, isActive: boolean) => {
    if (isActive) {
      return displayLang === "mr" ? "थांबवा" : displayLang === "hi" ? "रोकें" : "Stop";
    }
    return displayLang === "mr" ? "ऐका" : displayLang === "hi" ? "सुनें" : "Listen";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full h-[92vh] sm:h-[86vh] flex flex-col shadow-2xl border border-emerald-800/30 overflow-hidden">
        {/* Top Bar */}
        <div className="bg-emerald-950 text-white px-4 py-3 flex items-center justify-between gap-2 border-b border-emerald-800">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-800 border border-emerald-500 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6 text-amber-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-sm sm:text-lg text-white truncate">
                  {chatLang === "mr"
                    ? "कृषी मित्र AI सल्लागार"
                    : chatLang === "hi"
                      ? "कृषि मित्र AI सलाहकार"
                      : "Krishi Mitra AI Advisor"}
                </h2>
                <span className="hidden sm:inline-block text-[10px] font-bold bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600">
                  {rankedVoices.some((v) => v.isNeural) ? "HD Voice" : "Grounded"}
                </span>
              </div>
              <p className="text-[11px] text-emerald-300 truncate">
                {activeParcel
                  ? `${activeParcel.name} (${activeParcel.area_acres} ac / ${activeParcel.area_gunthas} gunthas)`
                  : `${farmer?.taluka || ""}, ${farmer?.district || "Maharashtra"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* AI Language Selector */}
            <div
              className="flex items-center bg-emerald-900 rounded-xl p-0.5 border border-emerald-700 text-[11px] font-bold"
              title="AI Reply & Voice Language"
            >
              {(
                [
                  { code: "mr" as Language, label: "मरा" },
                  { code: "hi" as Language, label: "हिं" },
                  { code: "en" as Language, label: "EN" }
                ]
              ).map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setChatLang(opt.code)}
                  className={`px-1.5 py-1 rounded-lg transition-colors ${
                    chatLang === opt.code
                      ? "bg-amber-400 text-emerald-950 font-black"
                      : "text-emerald-200 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Auto-Read Aloud Toggle */}
            <button
              type="button"
              onClick={handleToggleAutoSpeak}
              className={`p-2 rounded-xl border transition-colors ${
                autoSpeak
                  ? "bg-amber-400 text-emerald-950 border-amber-300"
                  : "bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border-emerald-700"
              }`}
              title={
                chatLang === "mr"
                  ? "उत्तर आपोआप बोलून दाखवा (Auto-Voice)"
                  : chatLang === "hi"
                    ? "उत्तर अपने आप बोलकर सुनाएं (Auto-Voice)"
                    : "Auto-speak AI replies"
              }
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Voice Speed & Voice Selector Toggle */}
            <button
              type="button"
              onClick={() => setShowVoicePanel((v) => !v)}
              className={`p-2 rounded-xl border transition-colors ${
                showVoicePanel
                  ? "bg-emerald-700 text-white border-emerald-400"
                  : "bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border-emerald-700"
              }`}
              title={
                chatLang === "mr"
                  ? "आवाज वेग आणि नॅचरल व्हॉइस निवडा"
                  : chatLang === "hi"
                    ? "आवाज की गति और वॉइस चुनें"
                    : "Voice speed & voice selector"
              }
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-xl bg-emerald-900 hover:bg-rose-900 text-emerald-200 hover:text-white transition-colors"
                title={
                  chatLang === "mr"
                    ? "संभाषण पुसा"
                    : chatLang === "hi"
                      ? "चैट इतिहास साफ़ करें"
                      : "Clear chat history"
                }
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-emerald-200 hover:text-white transition-colors"
              aria-label="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Collapsible Voice Tuning Bar */}
        {showVoicePanel && (
          <div className="bg-emerald-900 text-white px-4 py-2.5 border-b border-emerald-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-200">
                {chatLang === "mr" ? "वेग:" : chatLang === "hi" ? "गति:" : "Speed:"}
              </span>
              {[
                { rate: 0.85, mr: "हळू (0.85x)", hi: "धीमा (0.85x)", en: "Calm 0.85x" },
                { rate: 0.96, mr: "नैसर्गिक (1.0x)", hi: "प्राकृतिक (1.0x)", en: "Natural 1.0x" },
                { rate: 1.12, mr: "जलद (1.1x)", hi: "तेज़ (1.1x)", en: "Brisk 1.1x" }
              ].map((sp) => (
                <button
                  key={sp.rate}
                  type="button"
                  onClick={() => handleRateChange(sp.rate)}
                  className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                    Math.abs(speechRate - sp.rate) < 0.03
                      ? "bg-amber-400 text-emerald-950"
                      : "bg-emerald-800 text-emerald-100 hover:bg-emerald-700"
                  }`}
                >
                  {sp[chatLang]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[200px] justify-end">
              <select
                value={voiceURI || ""}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="bg-emerald-950 border border-emerald-700 text-emerald-100 text-[11px] font-semibold rounded-lg px-2 py-1 max-w-[230px] outline-none"
                aria-label="Select Voice"
              >
                <option value="">
                  {chatLang === "mr"
                    ? "सर्वोत्तम भारतीय आवाज (Auto)"
                    : chatLang === "hi"
                      ? "सर्वश्रेष्ठ भारतीय आवाज़ (Auto)"
                      : "Best Indian Natural Voice (Auto)"}
                </option>
                {rankedVoices.map((rv) => (
                  <option key={rv.voice.voiceURI} value={rv.voice.voiceURI}>
                    {rv.isNeural ? `★ ${rv.label}` : rv.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleTestVoice}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold"
              >
                <Play className="w-3 h-3" />
                <span>{chatLang === "mr" ? "तपासा" : chatLang === "hi" ? "टेस्ट" : "Test"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Grounded Prompt Chips */}
        <div className="bg-emerald-900/10 px-3.5 py-2 border-b border-stone-200 overflow-x-auto flex items-center space-x-2 shrink-0">
          <Sparkles className="w-4 h-4 text-emerald-800 shrink-0" />
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(chip)}
              disabled={isSending}
              className="text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-700/30 rounded-full px-3 py-1 whitespace-nowrap shadow-xs transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center justify-between">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="text-rose-700 ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="bg-white rounded-2xl p-5 border border-stone-200 text-center my-6 max-w-md mx-auto shadow-xs">
              <Bot className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
              <h3 className="font-black text-base text-stone-900">
                {chatLang === "mr"
                  ? `राम राम, ${farmer?.name || ""}! तुमच्या शेताबद्दल प्रश्न विचारा.`
                  : chatLang === "hi"
                    ? `राम राम, ${farmer?.name || ""}! अपने खेत के बारे में प्रश्न पूछें।`
                    : `Hello ${farmer?.name || ""}! Ask anything about your registered field.`}
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {chatLang === "mr"
                  ? "कृषी मित्र तुमच्या प्रत्यक्ष शेत तुकड्याचे क्षेत्रफळ, माती प्रकार, Open-Meteo हवामान आणि MPKV पीक योग्यता गुणांवर आधारित उत्तर देतो — व मराठी, हिंदी किंवा इंग्रजीतून बोलून ऐकवतो."
                  : chatLang === "hi"
                    ? "कृषि मित्र आपके खेत के वास्तविक क्षेत्रफल, मिट्टी के प्रकार, Open-Meteo मौसम और MPKV फसल उपयुक्तता अंकों के आधार पर उत्तर देता है — और मराठी, हिंदी या अंग्रेज़ी में अनुवाद कर सुनाता है।"
                    : "Krishi Mitra grounds every answer in your mapped parcel geometry, soil type, live Open-Meteo telemetry, and suitability scores — with natural Marathi, Hindi, and English voice + instant translation."}
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const { text: displayedText, displayLang } =
              msg.role === "assistant"
                ? getDisplayedMessage(msg)
                : { text: msg.content, displayLang: normalizeLangCode(msg.language) };
            const isSpeakingThis = speakingId === msg.id;
            const isTranslatingThis = translatingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3.5 shadow-xs ${
                    msg.role === "user"
                      ? "bg-emerald-800 text-white rounded-br-none"
                      : "bg-white text-stone-900 border border-stone-200 rounded-bl-none"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm font-semibold">{msg.content}</p>
                  ) : (
                    <div>
                      <div
                        className="text-xs sm:text-sm leading-relaxed space-y-1"
                        dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(displayedText) }}
                      />

                      {/* Translation + Voice Controls Bar */}
                      <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSpeakMessage(msg)}
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-bold transition-colors ${
                              isSpeakingThis
                                ? "bg-rose-100 text-rose-800 animate-pulse"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {isSpeakingThis ? (
                              <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                            )}
                            <span>{speakLabel(displayLang, isSpeakingThis)}</span>
                          </button>

                          {/* Per-Message Marathi / Hindi / English Translate Pills */}
                          <div
                            className="inline-flex items-center bg-stone-100 rounded-full p-0.5 border border-stone-200"
                            title="Translate message"
                          >
                            <Languages className="w-3 h-3 text-stone-500 ml-1.5 mr-1" />
                            {(
                              [
                                { code: "mr" as Language, label: "मराठी" },
                                { code: "hi" as Language, label: "हिंदी" },
                                { code: "en" as Language, label: "EN" }
                              ]
                            ).map((opt) => (
                              <button
                                key={opt.code}
                                type="button"
                                disabled={isTranslatingThis}
                                onClick={() => handleTranslateMessage(msg, opt.code)}
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                                  displayLang === opt.code
                                    ? "bg-emerald-800 text-white"
                                    : "text-stone-700 hover:bg-stone-200"
                                }`}
                              >
                                {isTranslatingThis && activeMsgLang[msg.id] !== opt.code
                                  ? opt.label
                                  : opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <span className="font-mono text-[10px] text-stone-400 mr-1">
                            {isTranslatingThis
                              ? "..."
                              : translatedCache[msg.id]?.[displayLang]?.provider ||
                                msg.provider ||
                                "grounded"}
                          </span>
                          <button
                            onClick={() => handleFeedback(msg.id, 1)}
                            className={`p-1 rounded hover:bg-emerald-50 ${
                              msg.feedback_rating === 1 ? "text-emerald-700 font-bold" : "text-stone-400"
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, -1)}
                            className={`p-1 rounded hover:bg-rose-50 ${
                              msg.feedback_rating === -1 ? "text-rose-700 font-bold" : "text-stone-400"
                            }`}
                            title="Not helpful"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3 text-xs font-bold text-emerald-900 flex items-center space-x-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />
                <span>
                  {chatLang === "mr"
                    ? "तुमच्या शेताचा हवामान व माती डेटा तपासत आहे..."
                    : chatLang === "hi"
                      ? "आपके खेत का मौसम और मिट्टी डेटा जांचा जा रहा है..."
                      : "Checking field weather & agronomic suitability..."}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Safety Footer & Input Box */}
        <div className="bg-white border-t border-stone-200 p-3">
          <div className="flex items-center space-x-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              {chatLang === "mr"
                ? "रासायनिक फवारणीपूर्वी स्थानिक कृषी विज्ञान केंद्र (KVK) किंवा कृषी अधिकाऱ्याचा सल्ला घ्या."
                : chatLang === "hi"
                  ? "रासायनिक छिड़काव से पहले नजदीकी कृषि विज्ञान केंद्र (KVK) या कृषि अधिकारी से सलाह लें; पहले समग्र कीट प्रबंधन (IPM) अपनाएं।"
                  : "Consult your local Krishi Vigyan Kendra (KVK) before chemical sprays; prioritize IPM."}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputText);
            }}
            className="flex items-center space-x-2"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`p-3 rounded-2xl border transition-colors ${
                isListening
                  ? "bg-rose-600 text-white border-rose-700 animate-pulse"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300"
              }`}
              title={
                chatLang === "mr"
                  ? "बोलून प्रश्न विचारा (मराठी)"
                  : chatLang === "hi"
                    ? "बोलकर प्रश्न पूछें (हिंदी)"
                    : "Voice Input"
              }
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                chatLang === "mr"
                  ? "येथे आपला कृषी प्रश्न लिहा किंवा माईक दाबा..."
                  : chatLang === "hi"
                    ? "अपना कृषि प्रश्न यहां लिखें या माइक दबाएं..."
                    : "Ask about your field, weather, crops, or IPM..."
              }
              maxLength={1000}
              className="flex-1 px-4 py-3 rounded-2xl bg-stone-50 border border-stone-300 focus:border-emerald-700 outline-none text-sm font-semibold text-stone-900"
            />

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="p-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-sm transition-colors"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
