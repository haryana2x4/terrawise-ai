import React, { useState, useEffect } from "react";
import { Language, translations } from "../i18n/translations";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Zap,
  CheckCircle2,
  Satellite,
  Sprout,
  ShieldCheck,
  ChevronDown,
  Activity,
  X
} from "lucide-react";
import { computeSunTheme } from "../utils/sunEngine";
import { LivingBackground } from "../components/LivingBackground";

interface LoginProps {
  lang: Language;
  tier: "full" | "lite";
  onToggleTier: () => void;
  onLanguageChange: (l: Language) => void;
  onLoginSuccess: (farmerData: any, token: string) => void;
}

interface DistrictWeather {
  district_en: string;
  district_mr: string;
  temperature_c: number | null;
  rain_probability_pct: number | null;
  source: string;
  observed_at: string;
}

export const Login: React.FC<LoginProps> = ({
  lang,
  tier,
  onToggleTier,
  onLanguageChange,
  onLoginSuccess
}) => {
  const [farmerId, setFarmerId] = useState(() => {
    return new URLSearchParams(window.location.search).get("fid")?.toUpperCase() || "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Legal / Status modal ("status" | "privacy" | "terms" | "accessibility" | null)
  const [infoModal, setInfoModal] = useState<string | null>(() => {
    return window.location.pathname === "/status" ? "status" : null;
  });
  const [statusPayload, setStatusPayload] = useState<any>(null);

  const [sunTheme, setSunTheme] = useState(() => computeSunTheme());
  const [weatherData, setWeatherData] = useState<DistrictWeather[]>([]);
  const [weatherUpdated, setWeatherUpdated] = useState<string>("");

  const t = translations[lang];

  useEffect(() => {
    const update = () => setSunTheme(computeSunTheme());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/v1/public/district-summary");
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.districts) {
            setWeatherData(json.districts);
            setWeatherUpdated(json.districts[0]?.observed_at || t.no_data);
          }
        }
      } catch {
        // Null-safe fallback
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [t.no_data]);

  useEffect(() => {
    if (infoModal === "status") {
      fetch("/api/v1/meta/status")
        .then(r => r.json())
        .then(data => setStatusPayload(data))
        .catch(() => setStatusPayload(null));
    }
  }, [infoModal]);

  const handleTierToggle = () => {
    onToggleTier();
  };

  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setFarmerId(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerId.trim() || !password.trim()) {
      setErrorMsg(
        lang === "mr"
          ? "कृपया शेतकरी आयडी आणि पासवर्ड टाका"
          : "Please enter Farmer ID and password"
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resp = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmer_id: farmerId.trim(),
          password: password.trim()
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            (lang === "mr" ? "लॉगिन अयशस्वी" : "Login failed")
        );
      }

      onLoginSuccess(data.farmer, data.access_token || data.token);
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          (lang === "mr"
            ? "लॉगिन करता आले नाही. आयडी किंवा पासवर्ड तपासा."
            : "Could not sign in. Verify your credentials.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const greetingText = sunTheme.greeting[lang] || sunTheme.greeting.mr;
  const phaseLabel = sunTheme.phaseLabel[lang] || sunTheme.phaseLabel.mr;

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden text-stone-900 font-sans selection:bg-amber-300 selection:text-emerald-950">
      {/* 1. LIVING ASTRONOMICAL HERO BACKGROUND LAYER */}
      <LivingBackground variant="hero" sunTheme={sunTheme} hasRain={false} isLiteTier={tier === "lite"} />

      {/* 4. TOP NAVIGATION BAR */}
      <header className="relative z-10 w-full px-2 sm:px-6 pt-2 pb-1 max-w-full overflow-hidden">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 bg-stone-900/75 backdrop-blur-md rounded-2xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/20 text-white shadow-lg">
          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-emerald-700/90 border border-emerald-400/50 flex items-center justify-center text-sm sm:text-xl shadow-inner shrink-0">
              🌱
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <span className="font-extrabold text-xs sm:text-lg tracking-tight text-white drop-shadow-sm truncate">
                  Kshetra
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold bg-emerald-600/80 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400/40">
                  महाराष्ट्र
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-amber-200/90 font-medium hidden sm:block">
                अहिल्यानगर • नाशिक शेतकरी सल्ला
              </p>
            </div>
          </div>

          {/* Live District Weather Pill */}
          <div className="hidden lg:flex items-center space-x-3 text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-1.5">
            <span className="text-amber-300 font-bold flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>थेट हवामान:</span>
            </span>
            {weatherData.length > 0 ? (
              weatherData.map((d, i) => (
                <span key={d.district_en} className="text-stone-200 flex items-center gap-1">
                  <span className="font-semibold text-white">
                    {lang === "mr" ? d.district_mr : d.district_en}:
                  </span>
                  <span className="font-mono text-amber-200">
                    {d.temperature_c !== null && d.temperature_c !== undefined
                      ? `${d.temperature_c}°C`
                      : t.no_data}
                  </span>
                  {i < weatherData.length - 1 && <span className="text-stone-500">|</span>}
                </span>
              ))
            ) : (
              <span className="text-stone-300">{t.no_data}</span>
            )}
            <span className="text-[10px] text-stone-400 border-l border-stone-600 pl-2">
              स्रोत: Open-Meteo
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <button
              onClick={handleTierToggle}
              title={
                tier === "full"
                  ? "Switch to Lite Tier (low data/battery)"
                  : "Switch to Full Rich Tier"
              }
              className="px-1.5 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border transition-colors flex items-center space-x-1 bg-black/40 border-white/20 text-stone-200 hover:text-white"
            >
              <Zap className={`w-3 h-3 ${tier === "lite" ? "text-amber-400" : "text-emerald-400"}`} />
              <span className="uppercase text-[9px] sm:text-[11px]">{tier}</span>
            </button>

            <div className="bg-black/50 rounded-xl border border-white/20 p-0.5 flex items-center text-[10px] sm:text-xs font-bold">
              <button
                onClick={() => onLanguageChange("mr")}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-colors ${
                  lang === "mr" ? "bg-emerald-700 text-white shadow-sm" : "text-stone-300 hover:text-white"
                }`}
              >
                मराठी
              </button>
              <button
                onClick={() => onLanguageChange("hi")}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-colors ${
                  lang === "hi" ? "bg-emerald-700 text-white shadow-sm" : "text-stone-300 hover:text-white"
                }`}
              >
                हिंदी
              </button>
              <button
                onClick={() => onLanguageChange("en")}
                className={`px-1.5 sm:px-2 py-0.5 rounded-lg transition-colors ${
                  lang === "en" ? "bg-emerald-700 text-white shadow-sm" : "text-stone-300 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 5. MAIN HERO SECTION */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-6 py-3 sm:py-10 max-w-full overflow-hidden">
        <div className="w-full max-w-[325px] sm:max-w-md mx-auto">
          <div
            className={`w-full rounded-3xl p-4 sm:p-8 transition-all duration-500 border border-amber-900/20 text-stone-900 ${
              tier === "full" ? "backdrop-blur-xl" : "shadow-xl"
            }`}
            style={{
              backgroundColor: "rgba(246, 239, 223, 0.94)",
              boxShadow:
                tier === "full"
                  ? `${sunTheme.shadowOffsetX}px ${sunTheme.shadowOffsetY}px ${sunTheme.shadowBlur}px rgba(15, 23, 42, 0.3)`
                  : "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
            }}
          >
            <div className="flex items-center justify-between mb-2.5 sm:mb-4 gap-2">
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-950/10 border border-emerald-900/15 text-emerald-900 text-[10px] sm:text-xs font-bold">
                <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />
                <span>{phaseLabel}</span>
                <span className="hidden sm:inline text-emerald-700/80 font-mono text-[10px]">
                  • {sunTheme.altitudeDeg}°
                </span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-stone-600">
                {greetingText} 🙏
              </span>
            </div>

            <div className="text-center mb-4 sm:mb-6">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-emerald-950 tracking-tight leading-snug">
                {lang === "mr"
                  ? "तुमची शेती. तुमचा निर्णय."
                  : lang === "hi"
                  ? "आपकी खेती. आपका निर्णय."
                  : "Your Land. Your Decision."}
              </h1>
              <p className="text-[11px] sm:text-sm text-stone-700 font-medium mt-1 leading-relaxed">
                {lang === "mr"
                  ? "उपग्रह डेटा व कृषी विद्यापीठाचा अचूक सल्ला"
                  : lang === "hi"
                  ? "उपग्रह डेटा व कृषि वैज्ञानिकों की सटीक सलाह"
                  : "Satellite telemetry & agricultural university guidance"}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-100/90 border border-rose-300 rounded-2xl flex items-start space-x-2 text-rose-900 text-xs sm:text-sm font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase text-stone-800 tracking-wider mb-1">
                  {t.farmer_id}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={farmerId}
                    onChange={handleIdChange}
                    placeholder={t.id_input_hint}
                    maxLength={24}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-3 sm:pl-11 sm:pr-4 py-3 sm:py-3.5 rounded-2xl bg-white/95 border-2 border-stone-300/80 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/15 outline-none font-mono font-bold text-base sm:text-lg text-stone-900 transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-stone-800 tracking-wider mb-1">
                  {t.password}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 sm:pl-11 sm:pr-12 py-3 sm:py-3.5 rounded-2xl bg-white/95 border-2 border-stone-300/80 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/15 outline-none font-bold text-base sm:text-lg text-stone-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 hover:text-stone-800 transition-colors p-2"
                    aria-label={t.show_password}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] sm:min-h-[52px] py-3 sm:py-3.5 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-base sm:text-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer mt-2"
              >
                <span>{isLoading ? t.logging_in : t.login_btn}</span>
              </button>
            </form>

            <div className="mt-4 pt-3.5 border-t border-stone-300/70 text-center">
              <p className="text-[11px] sm:text-xs text-stone-700 font-medium leading-relaxed">
                {lang === "mr"
                  ? "शेतकरी खाते आणि ओळखपत्र कृषी अधिकाऱ्याकडून जारी केले जाते."
                  : lang === "hi"
                  ? "किसान खाता और पहचान पत्र कृषि अधिकारी द्वारा जारी किया जाता है।"
                  : "Farmer accounts and credential cards are issued by your Agricultural Officer."}
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="#how-it-works"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-white bg-black/40 hover:bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 transition-all"
            >
              <span>{lang === "mr" ? "हे कसे काम करते? (पहा)" : "How it works"}</span>
              <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
            </a>
          </div>
        </div>
      </main>

      {/* 6. HOW IT WORKS SECTION */}
      <section
        id="how-it-works"
        className="relative z-10 w-full bg-stone-900/85 backdrop-blur-xl border-t border-white/10 text-stone-100 py-12 px-4 sm:px-6 mt-8"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
              {lang === "mr" ? "३ सोप्या पायऱ्या" : "3 Simple Steps"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
              {lang === "mr"
                ? "शेतकऱ्यांसाठी सोपे, खात्रीशीर आणि सुरक्षित"
                : "Simple, Verified, and Built for Smallholders"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xl font-bold mb-4">
                  १
                </div>
                <h3 className="text-lg font-black text-white mb-2">
                  {lang === "mr" ? "आपला शेतकरी आयडी टाका" : "Enter Your Farmer ID"}
                </h3>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {lang === "mr"
                    ? "प्रत्येक शेतकऱ्याला कृषी कार्यालयाकडून स्वतंत्र कार्ड आणि आयडी मिळतो. तुमची जमीन फक्त तुम्हालाच दिसते."
                    : "Each registered farmer holds an individual credential card and private parcel workspace."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>DPDP Act 2023 सुसंगत गोपनीयता</span>
              </div>
            </div>

            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-900/60 border border-sky-500/40 text-sky-300 flex items-center justify-center text-xl font-bold mb-4">
                  २
                </div>
                <h3 className="text-lg font-black text-white mb-2">
                  {lang === "mr" ? "उपग्रहावरून जमिनीची पाहणी" : "Satellite & Weather Telemetry"}
                </h3>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {lang === "mr"
                    ? "Open-Meteo, NASA POWER आणि ISRIC SoilGrids द्वारे मातीतील पाणी, तापमान व पावसाची नोंद थेट तुमच्या शेतासाठी."
                    : "Live soil water balance, temperature, and rainfall forecasts calibrated to your parcel centroid."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <Satellite className="w-4 h-4 text-sky-400" />
                <span>प्रत्यक्ष उपग्रह व हवामान डेटा</span>
              </div>
            </div>

            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-900/60 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xl font-bold mb-4">
                  ३
                </div>
                <h3 className="text-lg font-black text-white mb-2">
                  {lang === "mr" ? "कृषी मित्र AI आणि पीक सल्ला" : "Krishi Mitra AI & Crop Suitability"}
                </h3>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {lang === "mr"
                    ? "० ते १०० गुणांसह पीक निवड आणि एकात्मिक कीड व्यवस्थापन (IPM) मार्गदर्शन मराठी, हिंदी व इंग्रजीमध्ये."
                    : "0-100 crop suitability scoring and IPM-first pest guidance in Marathi, Hindi, and English."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-amber-400" />
                <span>सोपे व थेट मार्गदर्शन</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-stone-800/60 border border-emerald-600/30 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>डेटा स्रोत:</strong> Open-Meteo • NASA POWER • ISRIC SoilGrids • MPKV राहुरी
              </span>
            </div>
            <div className="text-stone-400 font-mono">
              {weatherUpdated || t.no_data}
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="relative z-10 w-full bg-stone-950 text-stone-400 text-xs py-5 px-4 sm:px-6 border-t border-stone-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <p className="font-semibold text-stone-300">
              {lang === "mr"
                ? "कृषी विज्ञान केंद्र (KVK) अहिल्यानगर व नाशिक अंतर्गत कृषी सल्ला प्रणाली"
                : "Agricultural Advisory System for Ahilya Nagar & Nashik"}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Kshetra v2.0 • DPDP Act 2023 Compliant
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            <button
              onClick={() => setInfoModal("status")}
              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>प्रणाली स्थिती (/status)</span>
            </button>
            <span className="text-stone-700">•</span>
            <button
              onClick={() => setInfoModal("privacy")}
              className="text-stone-300 hover:text-white underline"
            >
              गोपनीयता धोरण (Privacy)
            </button>
            <span className="text-stone-700">•</span>
            <button
              onClick={() => setInfoModal("terms")}
              className="text-stone-300 hover:text-white underline"
            >
              अटी (Terms)
            </button>
            <span className="text-stone-700">•</span>
            <button
              onClick={() => setInfoModal("accessibility")}
              className="text-stone-300 hover:text-white underline"
            >
              सुलभता (Accessibility)
            </button>
          </div>
        </div>
      </footer>

      {/* 8. PUBLIC STATUS, PRIVACY (DPDP 2023), TERMS & ACCESSIBILITY MODAL */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl text-stone-900 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <h3 className="font-black text-lg text-emerald-950">
                {infoModal === "status" && "प्रणाली आणि डेटा स्रोत स्थिती (System Status)"}
                {infoModal === "privacy" && "गोपनीयता धोरण (Privacy Notice — DPDP Act 2023)"}
                {infoModal === "terms" && "वापराच्या अटी (Terms of Use)"}
                {infoModal === "accessibility" && "सुलभता विधान (Accessibility Statement)"}
              </h3>
              <button
                onClick={() => setInfoModal(null)}
                className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {infoModal === "status" && (
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-950">Database &amp; Core API:</span>
                  <span className="font-mono font-bold text-emerald-800 uppercase">
                    {statusPayload?.status || "Operational"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                  <span className="font-bold text-stone-800">Active Farmer Slots:</span>
                  <span className="font-mono font-bold text-stone-900">
                    {statusPayload?.capacity
                      ? `${statusPayload.capacity.active_farmers} / ${statusPayload.capacity.max_farmers}`
                      : "0 / 20"}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-stone-700">Upstream Telemetry Feeds:</p>
                  {(statusPayload?.upstream_sources || []).length === 0 ? (
                    <p className="text-stone-500">
                      All integrations ready on demand (Open-Meteo, ISRIC SoilGrids, Agmarknet).
                    </p>
                  ) : (
                    statusPayload.upstream_sources.map((s: any) => (
                      <div
                        key={s.source_name}
                        className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between"
                      >
                        <span className="font-bold">{s.source_name}</span>
                        <span className="font-mono text-xs">
                          {s.status} {s.latency_ms ? `(${s.latency_ms} ms)` : ""}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {infoModal === "privacy" && (
              <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
                <p>
                  <strong>भारतीय डिजिटल वैयक्तिक डेटा संरक्षण कायदा २०२३ (DPDP Act 2023):</strong>
                </p>
                <p>
                  १. <strong>कोणता डेटा साठवला जातो:</strong> तुमचे नाव, गाव/तालुका/जिल्हा, नकाशावरील शेताची बहुभुज सीमा (Polygon), आणि पर्यायी मोबाईल/गट क्रमांक (AES/HMAC द्वारे एनक्रिप्टेड).
                </p>
                <p>
                  २. <strong>डेटाचा वापर:</strong> केवळ तुमच्या शेतासाठी हवामान अंदाज, पाण्याची गरज आणि पीक सल्ला देण्यासाठी. तुमचा डेटा कोणत्याही तिसऱ्या पक्षास विकला जात नाही.
                </p>
                <p>
                  ३. <strong>तुमचे अधिकार:</strong> तुम्ही तुमच्या प्रोफाईलमधून कधीही तुमचा संपूर्ण डेटा JSON स्वरूपात डाउनलोड करू शकता (Export My Data) किंवा तुमचे खाते व सर्व नोंदी कायमस्वरूपी हटवू शकता (Delete My Data).
                </p>
              </div>
            )}

            {infoModal === "terms" && (
              <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
                <p>
                  १. Kshetra वरील हवामान, माती आणि पीक सल्ला हा निर्णय सहाय्यासाठी आहे.
                </p>
                <p>
                  २. कोणतेही रासायनिक कीटकनाशक किंवा बुरशीनाशक फवारण्यापूर्वी स्थानिक कृषी विज्ञान केंद्र (KVK) किंवा कृषी अधिकाऱ्याचा प्रत्यक्ष सल्ला घेणे आवश्यक आहे.
                </p>
              </div>
            )}

            {infoModal === "accessibility" && (
              <div className="space-y-3 text-xs sm:text-sm text-stone-700 leading-relaxed">
                <p>
                  Kshetra हे WCAG 2.1 AA मानकांनुसार तयार केले आहे:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>मराठी, हिंदी आणि इंग्रजी भाषेत पूर्ण संवाद</li>
                  <li>आजचा सल्ला व कृषी मित्र उत्तरांसाठी आवाज वाचन (Text-to-Speech) आणि माईक इनपुट</li>
                  <li>कमी इंटरनेट व बॅटरीसाठी Lite Tier पर्याय</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
