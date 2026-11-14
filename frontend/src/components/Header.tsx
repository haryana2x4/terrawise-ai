import React from "react";
import { Language, translations } from "../i18n/translations";
import { User, LogOut, ShieldAlert, Globe } from "lucide-react";

interface HeaderProps {
  farmer: any;
  lang: Language;
  onLanguageChange: (l: Language) => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  farmer,
  lang,
  onLanguageChange,
  onLogout,
  onOpenAdmin
}) => {
  const t = translations[lang];

  return (
    <header className="bg-emerald-950 text-white px-4 py-3 shadow-md border-b-2 border-emerald-800">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Farmer Info */}
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-emerald-800 border-2 border-emerald-600 flex items-center justify-center font-bold text-lg text-emerald-200">
            🌱
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-emerald-100 tracking-wide">
                TERRAWISE AI
              </span>
              {farmer?.is_demo && (
                <span className="bg-amber-600/90 text-white text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-400">
                  {t.demo_badge}
                </span>
              )}
            </div>
            <div className="text-xs text-emerald-300 flex items-center space-x-1">
              <User className="w-3.5 h-3.5" />
              <span className="font-mono font-bold tracking-wider">{farmer?.farmer_id}</span>
              <span>•</span>
              <span>{farmer?.taluka || farmer?.district}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Language Switcher */}
          <div className="bg-emerald-900/80 rounded-lg p-0.5 border border-emerald-700 flex items-center text-xs font-medium">
            <button
              onClick={() => onLanguageChange("mr")}
              className={`px-2 py-1 rounded transition-colors ${lang === "mr" ? "bg-emerald-600 text-white font-bold" : "text-emerald-300 hover:text-white"}`}
            >
              मराठी
            </button>
            <button
              onClick={() => onLanguageChange("hi")}
              className={`px-2 py-1 rounded transition-colors ${lang === "hi" ? "bg-emerald-600 text-white font-bold" : "text-emerald-300 hover:text-white"}`}
            >
              हिंदी
            </button>
            <button
              onClick={() => onLanguageChange("en")}
              className={`px-2 py-1 rounded transition-colors ${lang === "en" ? "bg-emerald-600 text-white font-bold" : "text-emerald-300 hover:text-white"}`}
            >
              EN
            </button>
          </div>

          {/* Admin shortcut if admin */}
          {farmer?.role === "admin" && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="bg-amber-700 hover:bg-amber-600 text-white p-2 rounded-lg text-xs font-bold flex items-center space-x-1"
              title="Admin Portal"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          )}

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="text-emerald-400 hover:text-white p-2 rounded-lg hover:bg-emerald-900 transition-colors"
            title={t.logout}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
