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
  ShieldAlert
} from "lucide-react";
import { speakText, stopSpeaking } from "../utils/speech";

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
    .replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-amber-500 bg-amber-50/80 pl-2.5 py-1 my-1.5 text-xs text-amber-950 font-medium rounded-r">$1</blockquote>')
    .replace(/^-\s+(.+)$/gm, '<li class="ml-4 list-disc text-xs sm:text-sm my-0.5">$1</li>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  token,
  farmer,
  activeParcel,
  lang,
  onClose
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  }[lang];

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
    return () => stopSpeaking();
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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
      language: lang
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const resp = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: trimmed,
          language: lang,
          parcel_id: activeParcel?.id ?? null
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || data?.message || "Assistant request failed");
      }
      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
    } catch (err: any) {
      setErrorBanner(err.message || "Could not reach Krishi Mitra assistant.");
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const resp = await fetch("/api/v1/assistant/history", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setMessages([]);
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
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, feedback_rating: rating } : m))
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
        lang === "mr"
          ? "तुमच्या ब्राउझरमध्ये व्हॉइस टायपिंग उपलब्ध नाही."
          : "Voice recognition is not supported in this browser."
      );
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = lang === "mr" ? "mr-IN" : lang === "hi" ? "hi-IN" : "en-IN";
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

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      const plain = msg.content.replace(/[#*>_-]/g, " ");
      speakText(plain, lang);
      setSpeakingId(msg.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full h-[92vh] sm:h-[85vh] flex flex-col shadow-2xl border border-emerald-800/30 overflow-hidden">
        {/* Top Bar */}
        <div className="bg-emerald-950 text-white px-4 py-3.5 flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-800 border border-emerald-500 flex items-center justify-center">
              <Bot className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  {lang === "mr"
                    ? "कृषी मित्र AI सल्लागार"
                    : lang === "hi"
                    ? "कृषि मित्र AI सलाहकार"
                    : "Krishi Mitra AI Advisor"}
                </h2>
                <span className="text-[10px] font-bold bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600">
                  Grounded
                </span>
              </div>
              <p className="text-[11px] text-emerald-300">
                {activeParcel
                  ? `${activeParcel.name} (${activeParcel.area_acres} ac / ${activeParcel.area_gunthas} gunthas • ${activeParcel.soil_type})`
                  : `${farmer?.taluka || ""}, ${farmer?.district || "Maharashtra"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-xl bg-emerald-900 hover:bg-rose-900 text-emerald-200 hover:text-white transition-colors"
                title={lang === "mr" ? "संभाषण पुसा" : "Clear chat history"}
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
                {lang === "mr"
                  ? `राम राम, ${farmer?.name || ""}! तुमच्या शेताबद्दल प्रश्न विचारा.`
                  : lang === "hi"
                  ? `राम राम, ${farmer?.name || ""}! अपने खेत के बारे में प्रश्न पूछें।`
                  : `Hello ${farmer?.name || ""}! Ask anything about your registered field.`}
              </h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                {lang === "mr"
                  ? "कृषी मित्र तुमच्या प्रत्यक्ष शेत तुकड्याचे क्षेत्रफळ, माती प्रकार, Open-Meteo हवामान आणि MPKV पीक योग्यता गुणांवर आधारित उत्तर देतो."
                  : "Krishi Mitra grounds every answer in your mapped parcel geometry, soil type, live Open-Meteo telemetry, and suitability scores."}
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs ${
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
                      dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(msg.content) }}
                    />
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSpeakMessage(msg)}
                          className="inline-flex items-center space-x-1 text-emerald-800 hover:text-emerald-950 font-bold"
                        >
                          {speakingId === msg.id ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          <span>{speakingId === msg.id ? "थांबवा" : "ऐका"}</span>
                        </button>
                        <span>•</span>
                        <span className="font-mono text-[10px]">{msg.provider || "grounded"}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
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
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-200 rounded-2xl px-4 py-3 text-xs font-bold text-emerald-900 flex items-center space-x-2">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />
                <span>
                  {lang === "mr"
                    ? "तुमच्या शेताचा हवामान व माती डेटा तपासत आहे..."
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
              {lang === "mr"
                ? "रासायनिक फवारणीपूर्वी स्थानिक कृषी विज्ञान केंद्र (KVK) किंवा कृषी अधिकाऱ्याचा सल्ला घ्या."
                : "Consult your local Krishi Vigyan Kendra (KVK) before chemical sprays; prioritize IPM."}
            </span>
          </div>

          <form
            onSubmit={e => {
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
              title="Voice Input"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={
                lang === "mr"
                  ? "येथे आपला कृषी प्रश्न लिहा किंवा माईक दाबा..."
                  : lang === "hi"
                  ? "अपना कृषि प्रश्न यहां लिखें..."
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
