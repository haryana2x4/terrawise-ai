import React, { useState } from "react";
import { Language, translations } from "../i18n/translations";
import { Volume2, VolumeX, AlertCircle, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { speakText, stopSpeaking } from "../utils/speech";

interface TodayCardProps {
  todayData: any;
  lang: Language;
}

export const TodayCard: React.FC<TodayCardProps> = ({ todayData, lang }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [cardLang, setCardLang] = useState<Language>(lang);
  const t = translations[cardLang];

  React.useEffect(() => {
    setCardLang(lang);
  }, [lang]);

  React.useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const greeting =
    cardLang === "mr"
      ? todayData?.greeting_mr || ""
      : cardLang === "hi"
        ? todayData?.greeting_hi || todayData?.greeting_mr || ""
        : todayData?.greeting_en || "";

  const sentence =
    cardLang === "mr"
      ? todayData?.one_sentence_mr || "मातीतील ओलावा चांगला आहे. पिकाची काळजी घ्या."
      : cardLang === "hi"
        ? todayData?.one_sentence_hi || "मिट्टी की नमी अच्छी है। फसल की नियमित निगरानी रखें।"
        : todayData?.one_sentence_en || "Soil moisture is good. Monitor your field.";

  const action =
    cardLang === "mr"
      ? todayData?.one_action_mr || "चिकट सापळे लावून किडींवर लक्ष ठेवा."
      : cardLang === "hi"
        ? todayData?.one_action_hi || "कीट निगरानी के लिए पीले चिपचिपे ट्रैप लगाएं।"
        : todayData?.one_action_en || "Deploy sticky traps to monitor insect activity.";

  const trafficLevel = todayData?.traffic_light || "green";

  // Status badge: Icon + Word + Color
  let statusBadge = {
    bg: "bg-emerald-100",
    border: "border-emerald-500",
    text: "text-emerald-950",
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
    label:
      cardLang === "mr"
        ? "स्थिती: उत्तम (Safe)"
        : cardLang === "hi"
          ? "स्थिति: उत्तम (Safe)"
          : "Status: Good",
  };

  if (trafficLevel === "red") {
    statusBadge = {
      bg: "bg-rose-100",
      border: "border-rose-500",
      text: "text-rose-950",
      icon: <AlertCircle className="w-6 h-6 text-rose-600" />,
      label:
        cardLang === "mr"
          ? "स्थिती: सतर्कता (Alert)"
          : cardLang === "hi"
            ? "स्थिति: सतर्कता (Alert)"
            : "Status: Urgent Attention",
    };
  } else if (trafficLevel === "orange" || trafficLevel === "yellow") {
    statusBadge = {
      bg: "bg-amber-100",
      border: "border-amber-500",
      text: "text-amber-950",
      icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
      label:
        cardLang === "mr"
          ? "स्थिती: लक्ष द्या (Watch)"
          : cardLang === "hi"
            ? "स्थिति: ध्यान दें (Watch)"
            : "Status: Watch Closely",
    };
  }

  const stopLabel = cardLang === "mr" ? "थांबवा" : cardLang === "hi" ? "रोकें" : "Stop";

  const handleReadAloud = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
    } else {
      const prefix = greeting ? `${greeting}. ` : "";
      const fullText = `${prefix}${statusBadge.label}. ${sentence}. ${t.today_action} ${action}`;
      void speakText(fullText, cardLang, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });
    }
  };

  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-lg border-2 ${statusBadge.border} ${statusBadge.bg} transition-all`}>
      {/* Top Banner: Status + Quick Translate Switcher + Read Aloud */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          {statusBadge.icon}
          <span className={`font-bold text-sm sm:text-base tracking-wide ${statusBadge.text}`}>
            {statusBadge.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center bg-white/85 rounded-full p-0.5 border border-stone-300/80 text-[11px] font-bold shadow-xs"
            role="group"
            aria-label="Translate Daily Advisory"
          >
            {(
              [
                { code: "mr" as Language, label: "मराठी" },
                { code: "hi" as Language, label: "हिंदी" },
                { code: "en" as Language, label: "EN" },
              ]
            ).map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setIsPlaying(false);
                  setCardLang(opt.code);
                }}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  cardLang === opt.code
                    ? "bg-emerald-800 text-white"
                    : "text-stone-700 hover:bg-stone-200/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Big voice read-aloud button */}
          <button
            onClick={handleReadAloud}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all active:scale-95 ${
              isPlaying
                ? "bg-amber-900 hover:bg-amber-800 text-white ring-2 ring-amber-400 animate-pulse"
                : "bg-emerald-900 hover:bg-emerald-800 text-white"
            }`}
            title={t.read_aloud}
          >
            {isPlaying ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4 text-emerald-300" />}
            <span>{isPlaying ? stopLabel : t.read_aloud}</span>
          </button>
        </div>
      </div>

      {/* Main Single Sentence (<=12 words, 18px+ font) */}
      <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 leading-snug mb-3">
        {sentence}
      </h2>

      {/* Clear Action Box */}
      <div className="bg-white/90 rounded-xl p-3 sm:p-4 border border-stone-200/80 shadow-sm flex items-start space-x-3">
        <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800 font-bold shrink-0">
          <ArrowRight className="w-5 h-5" />
        </div>
        <div>
          <span className="block text-xs uppercase tracking-wider font-extrabold text-emerald-900 mb-0.5">
            {t.today_action}
          </span>
          <p className="text-base sm:text-lg font-bold text-stone-800 leading-normal">
            {action}
          </p>
        </div>
      </div>
    </div>
  );
};
