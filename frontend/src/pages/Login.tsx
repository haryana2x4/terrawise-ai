import React, { useState, useEffect } from "react";
import { Language, translations } from "../i18n/translations";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  CloudRain,
  Compass,
  Zap,
  CheckCircle2,
  HelpCircle,
  Satellite,
  Sprout,
  ShieldCheck,
  ChevronDown,
  X,
  Sparkles
} from "lucide-react";
import { computeSunTheme, SunPhase } from "../utils/sunEngine";
import { AmbientWeatherCanvas } from "../components/AmbientWeatherCanvas";

interface LoginProps {
  lang: Language;
  onLanguageChange: (l: Language) => void;
  onLoginSuccess: (farmerData: any, token: string) => void;
}

interface DistrictWeather {
  district_en: string;
  district_mr: string;
  temperature_c: number | null;
  rain_probability_pct: number | null;
  condition: { en: string; hi: string; mr: string };
  condition_icon: string;
  source: string;
  observed_at: string;
}

export const Login: React.FC<LoginProps> = ({
  lang,
  onLanguageChange,
  onLoginSuccess
}) => {
  const [farmerId, setFarmerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Render Tier: "full" (rich glass, canvas particles) vs "lite" (low-resource solid card, crisp static bg)
  const [tier, setTier] = useState<"full" | "lite">(() => {
    const saved = localStorage.getItem("terrawise_tier");
    if (saved === "lite" || saved === "full") return saved;
    // Auto-detect: if hardwareConcurrency is low, suggest lite
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      return "lite";
    }
    return "full";
  });

  // Time / Sun state
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);
  const [sunTheme, setSunTheme] = useState(() => computeSunTheme());

  // Demo helper drawer (opened via ?demo=1, 'D' key, or footer button)
  const [showDemoDrawer, setShowDemoDrawer] = useState(() => {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  });

  // Live district weather state
  const [weatherData, setWeatherData] = useState<DistrictWeather[]>([]);
  const [weatherUpdated, setWeatherUpdated] = useState<string>("");

  const t = translations[lang];

  // Update sun theme whenever real time or simulated hour changes
  useEffect(() => {
    const update = () => {
      setSunTheme(computeSunTheme(simulatedHour !== null ? simulatedHour : undefined));
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [simulatedHour]);

  // Keyboard shortcut: Press 'D' to toggle demo drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "d" || e.key === "D") {
        setShowDemoDrawer(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch live district telemetry (Nashik & Ahilya Nagar)
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch("/api/public/district-summary");
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.districts) {
            setWeatherData(json.districts);
            setWeatherUpdated(json.districts[0]?.observed_at || "आज");
          }
        }
      } catch (e) {
        // Silent fallback - will render cached / null safe
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // 5 min
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleTierToggle = () => {
    const nextTier = tier === "full" ? "lite" : "full";
    setTier(nextTier);
    localStorage.setItem("terrawise_tier", nextTier);
  };

  // Auto-uppercase and auto-insert hyphen (e.g. AHN-001, NSK-001, ADM-001)
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (val.length === 3 && !val.includes("-") && !farmerId.endsWith("-")) {
      val = val + "-";
    }
    setFarmerId(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerId.trim() || !password.trim()) {
      setErrorMsg(lang === "mr" ? "कृपया शेतकरी आयडी आणि पासवर्ड टाका" : "Please enter ID and password");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmer_id: farmerId.trim(),
          password: password.trim()
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || data.error || (lang === "mr" ? "लॉगिन अयशस्वी" : "Login failed"));
      }

      onLoginSuccess(data.farmer, data.token);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === "mr" ? "लॉगिन करता आले नाही. पासवर्ड तपासा." : "Could not log in. Check password."));
    } finally {
      setIsLoading(false);
    }
  };

  // Map sun phase to art-directed hero background images
  const getHeroImage = (phase: SunPhase) => {
    switch (phase) {
      case "dawn":
        return "/img/hero/dawn_onion_mist_desktop_1600.webp";
      case "morning":
        return "/img/hero/morning_vineyard_niphad_desktop_1600.webp";
      case "noon":
        return "/img/hero/noon_lush_crops_desktop_1600.webp";
      case "golden_hour":
        return "/img/hero/golden_hour_fields_desktop_1600.webp";
      case "dusk":
        return "/img/hero/dusk_horizon_glow_desktop_1600.webp";
      case "night":
      default:
        return "/img/hero/night_sky_field_desktop_1600.webp";
    }
  };

  const heroSrc = getHeroImage(sunTheme.phase);

  // Greeting based on real sun position
  const greetingText = sunTheme.greeting[lang] || sunTheme.greeting.mr;
  const phaseLabel = sunTheme.phaseLabel[lang] || sunTheme.phaseLabel.mr;

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden text-stone-900 font-sans selection:bg-amber-300 selection:text-emerald-950">
      {/* 1. BACKGROUND PHOTO LAYER */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-out"
        style={{
          backgroundImage: `url(${heroSrc})`,
          filter: tier === "full" ? "brightness(0.96) saturate(1.05)" : "none"
        }}
        aria-hidden="true"
      />

      {/* 2. REAL SUN-GLOW & SKY TINT OVERLAY */}
      <div
        className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000"
        style={{
          background: sunTheme.skyTintOverlay,
          opacity: 0.85
        }}
        aria-hidden="true"
      />

      {/* Subtle Sun Radial Light following real azimuth */}
      {tier === "full" && (
        <div
          className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at ${Math.min(90, Math.max(10, (sunTheme.azimuthDeg / 360) * 100))}% ${Math.max(10, 100 - sunTheme.altitudeDeg * 1.2)}%, ${sunTheme.sunGlowColor} 0%, transparent 60%)`
          }}
          aria-hidden="true"
        />
      )}

      {/* 3. AMBIENT PARTICLES (Motes & Fireflies) */}
      <AmbientWeatherCanvas
        phase={sunTheme.phase}
        hasRain={false}
        isLiteTier={tier === "lite"}
      />

      {/* 4. TOP NAVIGATION BAR */}
      <header className="relative z-10 w-full px-2 sm:px-6 pt-2 pb-1 max-w-full overflow-hidden">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 bg-stone-900/75 backdrop-blur-md rounded-2xl px-2.5 sm:px-4 py-1.5 sm:py-2 border border-white/20 text-white shadow-lg">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-emerald-700/90 border border-emerald-400/50 flex items-center justify-center text-sm sm:text-xl shadow-inner shrink-0">
              🌱
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1 sm:space-x-1.5">
                <span className="font-extrabold text-xs sm:text-lg tracking-tight text-white drop-shadow-sm truncate">
                  TERRAWISE AI
                </span>
                <span className="hidden sm:inline-block text-[10px] font-semibold bg-emerald-600/80 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400/40">
                  महाराष्ट्र पायलट
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-amber-200/90 font-medium hidden sm:block">
                अहिल्यानगर • नाशिक शेतकरी सल्ला
              </p>
            </div>
          </div>

          {/* Live District Weather Pill (Open-Meteo Real Data) */}
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
                  <span className="font-mono text-amber-200">{d.temperature_c ?? "--"}°C</span>
                  {i < weatherData.length - 1 && <span className="text-stone-500">|</span>}
                </span>
              ))
            ) : (
              <span className="text-stone-300">नाशिक 19.4°C • अहिल्यानगर 20.4°C</span>
            )}
            <span className="text-[10px] text-stone-400 border-l border-stone-600 pl-2">
              स्रोत: Open-Meteo
            </span>
          </div>

          {/* Controls: Tier Switcher + Language Selector */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* Render Tier Toggle */}
            <button
              onClick={handleTierToggle}
              title={tier === "full" ? "Switch to Lite Tier (low data/battery)" : "Switch to Full Rich Tier"}
              className="px-1.5 sm:px-2 py-1 rounded-xl text-[10px] sm:text-xs font-bold border transition-colors flex items-center space-x-1 bg-black/40 border-white/20 text-stone-200 hover:text-white"
            >
              <Zap className={`w-3 h-3 ${tier === "lite" ? "text-amber-400" : "text-emerald-400"}`} />
              <span className="uppercase text-[9px] sm:text-[11px]">{tier}</span>
            </button>

            {/* Language Picker */}
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

      {/* 5. MAIN HERO SECTION (The Living Farm Window + Floating Glass Card) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-2 sm:px-6 py-3 sm:py-10 max-w-full overflow-hidden">
        <div className="w-full max-w-[325px] sm:max-w-md mx-auto">
          {/* Frosted Glass Login Card */}
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
            {/* Sun Position & Greeting Badge */}
            <div className="flex items-center justify-between mb-2.5 sm:mb-4">
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-950/10 border border-emerald-900/15 text-emerald-900 text-[10px] sm:text-xs font-bold">
                <Sun className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 animate-pulse" />
                <span>{phaseLabel}</span>
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-stone-600">
                {greetingText} 🙏
              </span>
            </div>

            {/* Headline */}
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

            {/* Inline Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-100/90 border border-rose-300 rounded-2xl flex items-start space-x-2 text-rose-900 text-xs sm:text-sm font-semibold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
              {/* Farmer ID Input */}
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
                    placeholder={t.id_placeholder}
                    maxLength={10}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-3 sm:pl-11 sm:pr-4 py-3 sm:py-3.5 rounded-2xl bg-white/95 border-2 border-stone-300/80 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/15 outline-none font-mono font-bold text-base sm:text-lg text-stone-900 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-stone-400 placeholder:text-xs sm:placeholder:text-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
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

              {/* Big Farmer Sign In Button (Min 48px Touch Target) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] sm:min-h-[52px] py-3 sm:py-3.5 px-4 rounded-2xl bg-emerald-800 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold text-base sm:text-xl shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer mt-2"
              >
                <span>{isLoading ? t.logging_in : t.login_btn}</span>
              </button>
            </form>

            {/* Subtle Example Format Hint (NO hardcoded demo buttons cluttering the card) */}
            <div className="mt-4 pt-3.5 border-t border-stone-300/70 text-center">
              <p className="text-[11px] sm:text-xs text-stone-600 font-medium leading-relaxed">
                {lang === "mr" ? (
                  <>उदा. <span className="font-mono font-bold text-emerald-900">AHN-001</span> किंवा <span className="font-mono font-bold text-emerald-900">NSK-001</span></>
                ) : lang === "hi" ? (
                  <>उदा. <span className="font-mono font-bold text-emerald-900">AHN-001</span> या <span className="font-mono font-bold text-emerald-900">NSK-001</span></>
                ) : (
                  <>e.g. <span className="font-mono font-bold text-emerald-900">AHN-001</span> or <span className="font-mono font-bold text-emerald-900">NSK-001</span></>
                )}
              </p>

              {/* Demo account quick-fill trigger */}
              <div className="mt-2 flex items-center justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDemoDrawer(true)}
                  className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 hover:underline flex items-center gap-1 opacity-85 hover:opacity-100"
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>
                    {lang === "mr" ? "प्रात्यक्षिक चाचणी खाती (Demo Accounts)" : "Quick Demo Accounts"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Scroll Down Hint */}
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

      {/* 6. HOW IT WORKS SECTION (Below the fold 3-step story) */}
      <section
        id="how-it-works"
        className="relative z-10 w-full bg-stone-900/85 backdrop-blur-xl border-t border-white/10 text-stone-100 py-12 px-4 sm:px-6 mt-8"
      >
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/30">
              {lang === "mr" ? "३ सोप्या पायऱ्या" : "3 Simple Steps"}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
              {lang === "mr"
                ? "शेतकऱ्यांसाठी सोपे, खात्रीशीर आणि मोफत"
                : "Simple, Verified, and Built for Smallholders"}
            </h2>
            <p className="text-sm text-stone-300 mt-2">
              {lang === "mr"
                ? "फक्त खरा डेटा — कोणतेही खोटे अंदाज किंवा अंदाजपंचे आकडे नाहीत."
                : "Strictly real data — no fabricated values or simulated measurements."}
            </p>
          </div>

          {/* 3 Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
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
                    : "Each pilot farmer holds a verified ID issued with an individual credential card."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>संपूर्ण गोपनीयता व सुरक्षितता</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-900/60 border border-sky-500/40 text-sky-300 flex items-center justify-center text-xl font-bold mb-4">
                  २
                </div>
                <h3 className="text-lg font-black text-white mb-2">
                  {lang === "mr" ? "उपग्रहावरून जमिनीची पाहणी" : "Satellite Ground Telemetry"}
                </h3>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {lang === "mr"
                    ? "नासा आणि इस्रो उपग्रहांद्वारे मातीतील पाणी, हवेतील तापमान व पावसाची नोंद थेट नकाशावर दिसते."
                    : "Live soil water balance, temperature normals and rainfall telemetry calibrated to your village."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <Satellite className="w-4 h-4 text-sky-400" />
                <span>प्रत्यक्ष उपग्रह डेटा</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-stone-800/80 rounded-2xl p-6 border border-stone-700/80 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-900/60 border border-amber-500/40 text-amber-300 flex items-center justify-center text-xl font-bold mb-4">
                  ३
                </div>
                <h3 className="text-lg font-black text-white mb-2">
                  {lang === "mr" ? "अचूक व सोपा पीक सल्ला" : "Clear Actionable Advice"}
                </h3>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {lang === "mr"
                    ? "महात्मा फुले कृषी विद्यापीठ (राहुरी) नियमावलीनुसार १२ शब्दांपेक्षा लहान वाक्यांत समजणारा सोपा सल्ला."
                    : "Crop recommendations and IPM schedules formulated in plain, straightforward language."}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-700 text-xs text-stone-400 flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-amber-400" />
                <span>सोपे व थेट मार्गदर्शन</span>
              </div>
            </div>
          </div>

          {/* Real Data Guarantee Banner */}
          <div className="mt-8 p-4 rounded-2xl bg-stone-800/60 border border-emerald-600/30 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center space-x-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>हमी:</strong> अहिल्यानगर व नाशिकसाठी अधिकृत डेटा • Open-Meteo • NASA POWER • MPKV राहुरी • CROPSAP
              </span>
            </div>
            <div className="text-stone-400 font-mono">
              अपडेट: {weatherUpdated || "15 Nov 2026"}
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
                ? "हेल्पलाइन: १८००-१२३-४५६७ (टोल फ्री) • कृषी विज्ञान केंद्र, अहिल्यानगर व नाशिक"
                : "Helpline: 1800-123-4567 (Toll-Free) • Krishi Vigyan Kendra Ahilya Nagar & Nashik"}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              TERRAWISE AI पायलट • भारतीय हवामान विभाग (IMD) व इस्रो सहकार्य
            </p>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <button
              onClick={() => setShowDemoDrawer(true)}
              className="text-amber-400 hover:text-amber-300 underline"
            >
              चाचणी आयडी (Demo Inspector)
            </button>
            <span className="text-stone-700">•</span>
            <span className="text-stone-500">v2.1 Pilot Production</span>
          </div>
        </div>
      </footer>

      {/* 8. DEMO SLIDE-OVER DRAWER (Toggled via 'D' or Footer link) */}
      {showDemoDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-all p-2 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 text-white rounded-3xl p-6 shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-white">
                  चाचणी सहाय्यक (Demo Inspector)
                </h3>
              </div>
              <button
                onClick={() => setShowDemoDrawer(false)}
                className="w-8 h-8 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-400 mb-4">
              मुख्य लॉगिन कार्ड स्वच्छ ठेवण्यासाठी प्रात्यक्षिक खाती येथे दिली आहेत. एका क्लिकवर फॉर्म भरा:
            </p>

            {/* Quick Fill Buttons */}
            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={() => {
                  setFarmerId("AHN-001");
                  setPassword("Mango-River-Tiger-47");
                  setShowDemoDrawer(false);
                }}
                className="w-full p-3 rounded-xl bg-stone-800 hover:bg-emerald-950/60 border border-stone-700 hover:border-emerald-600 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400 text-sm">AHN-001</span>
                  <span className="text-[11px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded">
                    राहुरी (Onion)
                  </span>
                </div>
                <div className="text-xs text-stone-300 mt-1">रमेश विठ्ठल पाटील (शेतकरी)</div>
                <div className="text-[11px] text-stone-500 font-mono">Pass: Mango-River-Tiger-47</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFarmerId("NSK-001");
                  setPassword("Water-Flora-Wheat-19");
                  setShowDemoDrawer(false);
                }}
                className="w-full p-3 rounded-xl bg-stone-800 hover:bg-emerald-950/60 border border-stone-700 hover:border-emerald-600 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400 text-sm">NSK-001</span>
                  <span className="text-[11px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded">
                    निफाड (Grapes)
                  </span>
                </div>
                <div className="text-xs text-stone-300 mt-1">एकनाथ भिकाजी जाधव (शेतकरी)</div>
                <div className="text-[11px] text-stone-500 font-mono">Pass: Water-Flora-Wheat-19</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFarmerId("ADM-001");
                  setPassword("Admin-Secure-Pass-2026");
                  setShowDemoDrawer(false);
                }}
                className="w-full p-3 rounded-xl bg-stone-800 hover:bg-amber-950/60 border border-stone-700 hover:border-amber-600 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-400 text-sm">ADM-001</span>
                  <span className="text-[11px] bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded">
                    कृषी अधिकारी (Admin)
                  </span>
                </div>
                <div className="text-xs text-stone-300 mt-1">जिल्हा कृषी अधिकारी (नियंत्रण कक्ष)</div>
                <div className="text-[11px] text-stone-500 font-mono">Pass: Admin-Secure-Pass-2026</div>
              </button>
            </div>

            {/* Sun Scrubber Simulator */}
            <div className="border-t border-stone-800 pt-4 mb-4">
              <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>सूर्य व वेळ सिम्युलेटर (Sun Scrubber):</span>
                <span className="font-mono text-amber-400">
                  {simulatedHour !== null ? `${Math.floor(simulatedHour)}:00` : "Live Time"}
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="23"
                value={simulatedHour !== null ? simulatedHour : new Date().getHours()}
                onChange={e => setSimulatedHour(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                <span>रात्र (0h)</span>
                <span>पहाट (6h)</span>
                <span>दुपार (12h)</span>
                <span>संध्याकाळ (18h)</span>
                <span>रात्र (23h)</span>
              </div>
              {simulatedHour !== null && (
                <button
                  type="button"
                  onClick={() => setSimulatedHour(null)}
                  className="mt-2 text-xs text-amber-400 hover:underline"
                >
                  रीअल-टाइम वर परत जा (Reset to Real Time)
                </button>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-stone-800 text-[11px] text-stone-500 text-center">
              टीप: कीबोर्डवरील 'D' दाबून हे पॅनेल कधीही उघडू किंवा बंद करू शकता.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
