import React from "react";
import { Language, translations } from "../i18n/translations";
import { User, LogOut, ShieldAlert, Bot, Zap, Download } from "lucide-react";

interface HeaderProps {
  farmer: any;
  lang: Language;
  tier?: "full" | "lite";
  onToggleTier?: () => void;
  onLanguageChange: (l: Language) => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
  onOpenAssistant?: () => void;
  onOpenInstallModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  farmer,
  lang,
  tier = "full",
  onToggleTier,
  onLanguageChange,
  onLogout,
  onOpenAdmin,
  onOpenAssistant,
  onOpenInstallModal
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-30 bg-emerald-950/90 backdrop-blur-md text-white px-4 py-3 shadow-lg border-b border-emerald-700/60">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Farmer Info */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-400/50 flex items-center justify-center font-bold text-lg text-emerald-100 shadow-inner shrink-0">
            🌱
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-white tracking-tight">
                Kshetra
              </span>
              <span className="bg-emerald-700/80 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                {farmer?.district || "Maharashtra"}
              </span>
            </div>
            <div className="text-xs text-emerald-300 flex items-center space-x-1 truncate">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono font-bold tracking-wider">{farmer?.farmer_id}</span>
              <span>•</span>
              <span className="truncate">{farmer?.taluka || farmer?.village || farmer?.district}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border border-emerald-400/50 shadow-sm transition-all"
              title={t.assistant_btn}
            >
              <Bot className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">कृषी मित्र AI</span>
            </button>
          )}

          {onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              className="bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 border border-emerald-500/40 shadow-xs transition-all"
              title={lang === "mr" ? "अ‍ॅप इंस्टॉल किंवा शेअर करा" : "Install or Share App"}
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden md:inline">
                {lang === "mr" ? "अ‍ॅप घ्या" : "Install"}
              </span>
            </button>
          )}

          {onToggleTier && (
            <button
              onClick={onToggleTier}
              className="hidden sm:flex px-2 py-1.5 rounded-xl text-[11px] font-bold border border-emerald-700 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 items-center space-x-1"
              title="Toggle Full / Lite performance mode"
            >
              <Zap className={`w-3.5 h-3.5 ${tier === "lite" ? "text-amber-400" : "text-emerald-400"}`} />
              <span className="uppercase">{tier}</span>
            </button>
          )}

          {/* Language Switcher */}
          <div className="bg-emerald-900/80 rounded-xl p-0.5 border border-emerald-700/80 flex items-center text-xs font-medium">
            <button
              onClick={() => onLanguageChange("mr")}
              className={`px-2 py-1 rounded-lg transition-colors ${lang === "mr" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-emerald-300 hover:text-white"}`}
            >
              मराठी
            </button>
            <button
              onClick={() => onLanguageChange("hi")}
              className={`px-2 py-1 rounded-lg transition-colors ${lang === "hi" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-emerald-300 hover:text-white"}`}
            >
              हिंदी
            </button>
            <button
              onClick={() => onLanguageChange("en")}
              className={`px-2 py-1 rounded-lg transition-colors ${lang === "en" ? "bg-emerald-600 text-white font-bold shadow-xs" : "text-emerald-300 hover:text-white"}`}
            >
              EN
            </button>
          </div>

          {/* Admin shortcut if admin */}
          {farmer?.role === "admin" && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm"
              title={t.admin_btn}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden md:inline">{t.admin_btn}</span>
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="text-emerald-300 hover:text-white p-2 rounded-xl hover:bg-emerald-900/90 transition-colors"
            title={t.logout}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
