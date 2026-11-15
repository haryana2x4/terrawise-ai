import React, { useState, useEffect, useCallback } from "react";
import { Language, translations } from "../i18n/translations";
import { Header } from "../components/Header";
import { TodayCard } from "../components/TodayCard";
import { MiniCards } from "../components/MiniCards";
import { WhatToPlantModal } from "../components/WhatToPlantModal";
import { FarmMap } from "../components/FarmMap";
import { AssistantChat } from "../components/AssistantChat";
import {
  Sprout,
  Map,
  Menu,
  X,
  Bot,
  Megaphone,
  CloudRain,
  Download,
  Trash2,
  MessageSquareWarning,
  ShieldCheck,
  KeyRound
} from "lucide-react";

interface FarmerHomeProps {
  farmer: any;
  token: string;
  lang: Language;
  onLanguageChange: (l: Language) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export const FarmerHome: React.FC<FarmerHomeProps> = ({
  farmer,
  token,
  lang,
  onLanguageChange,
  onLogout,
  onOpenAdmin
}) => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showWhatToPlant, setShowWhatToPlant] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [showAssistant, setShowAssistant] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);

  // First-login consent & password change states
  const [consentAccepted, setConsentAccepted] = useState<boolean>(
    Boolean(farmer?.consent_accepted)
  );
  const [mustChangePwd, setMustChangePwd] = useState<boolean>(
    Boolean(farmer?.must_change_password)
  );
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  // Field observation logger ("Add today's rain")
  const [rainMmInput, setRainMmInput] = useState("");
  const [obsNoteInput, setObsNoteInput] = useState("");
  const [obsStatus, setObsStatus] = useState<string | null>(null);

  // Report a problem modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSent, setReportSent] = useState(false);

  // Live Mandi state
  const [marketData, setMarketData] = useState<any>(null);

  const t = translations[lang];

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/v1/farmer/dashboard?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        setDashboardData(data);
        if (data.farmer) {
          setConsentAccepted(Boolean(data.farmer.consent_accepted));
          setMustChangePwd(Boolean(data.farmer.must_change_password));
        }
      }
    } catch {
      // Offline / network error handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [token, lang]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (showMenu && !marketData) {
      fetch(`/api/v1/markets?district=${encodeURIComponent(farmer?.district || "Ahilya Nagar")}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => setMarketData(d))
        .catch(() => setMarketData({ status: "unavailable", records: [] }));
    }
  }, [showMenu, marketData, farmer?.district, token]);

  const handleAcceptConsent = async () => {
    try {
      const resp = await fetch("/api/v1/auth/consent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        setConsentAccepted(true);
      }
    } catch {
      // Ignore
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.trim().length < 8) {
      setPwdMsg(
        lang === "mr"
          ? "नवीन पासवर्ड किमान ८ अक्षरांचा असावा."
          : "New password must be at least 8 characters."
      );
      return;
    }
    try {
      const resp = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPassword.trim() })
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || "Failed to update password");
      }
      setMustChangePwd(false);
      setNewPassword("");
      setPwdMsg(null);
    } catch (err: any) {
      setPwdMsg(err.message);
    }
  };

  const handleAddObservation = async (e: React.FormEvent, parcelId: number) => {
    e.preventDefault();
    setObsStatus(null);
    try {
      const resp = await fetch(`/api/v1/parcels/${parcelId}/observations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rain_mm: rainMmInput !== "" ? parseFloat(rainMmInput) : null,
          notes: obsNoteInput.trim() || null
        })
      });
      if (resp.ok) {
        setRainMmInput("");
        setObsNoteInput("");
        setObsStatus(lang === "mr" ? "आजची नोंद जतन झाली!" : "Field observation saved!");
        loadDashboard();
      }
    } catch {
      setObsStatus("Could not save observation.");
    }
  };

  const handleExportMyData = async () => {
    try {
      const resp = await fetch("/api/v1/farmers/me/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kshetra_data_${farmer.farmer_id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  };

  const handleDeleteMyData = async () => {
    const confirmed = window.confirm(
      lang === "mr"
        ? "तुम्हाला तुमचे खाते आणि सर्व शेत नोंदी कायमच्या हटवायच्या आहेत का? (DPDP Act 2023)"
        : "Are you sure you want to permanently erase your account and all field data?"
    );
    if (!confirmed) return;
    try {
      const resp = await fetch("/api/v1/farmers/me", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (resp.ok) {
        onLogout();
      }
    } catch {
      // Ignore
    }
  };

  const handleSendProblemReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    try {
      const resp = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_type: "problem_report",
          comment: reportText.trim()
        })
      });
      if (resp.ok) {
        setReportSent(true);
        setReportText("");
      }
    } catch {
      // Ignore
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-full border-4 border-emerald-800 border-t-transparent animate-spin mb-4" />
        <p className="font-bold text-emerald-950 text-lg">माहिती लोड होत आहे...</p>
        <p className="text-xs text-stone-500 mt-1">
          Fetching live weather &amp; parcel telemetry
        </p>
      </div>
    );
  }

  const todayData = dashboardData?.today_card;
  const weather = dashboardData?.weather;
  const suitability = dashboardData?.suitability;
  const risks = dashboardData?.risks;
  const parcels = dashboardData?.parcels || [];
  const announcements = dashboardData?.announcements || [];
  const observations = dashboardData?.observations || [];
  const activeParcel = todayData?.active_parcel || parcels[0] || null;
  const displayName = dashboardData?.farmer?.name || farmer?.name || farmer?.full_name || "";

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between font-sans">
      <Header
        farmer={dashboardData?.farmer || farmer}
        lang={lang}
        onLanguageChange={onLanguageChange}
        onLogout={onLogout}
        onOpenAdmin={farmer.role === "admin" ? onOpenAdmin : undefined}
        onOpenAssistant={() => setShowAssistant(true)}
      />

      <main className="max-w-md sm:max-w-xl md:max-w-2xl w-full mx-auto px-3.5 sm:px-6 py-3 flex-1 flex flex-col justify-between space-y-3">
        {/* Officer Announcements Inbox Banner */}
        {announcements.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-3 shadow-xs space-y-1">
            {announcements.slice(0, 2).map((ann: any) => (
              <div key={ann.id} className="flex items-start space-x-2 text-xs">
                <Megaphone className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold text-amber-950">
                    {ann.title?.[lang] || ann.title?.mr}:{" "}
                  </span>
                  <span className="text-stone-800 font-medium">
                    {ann.body?.[lang] || ann.body?.mr}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Farmer Greeting & Active Parcel Status */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900 leading-tight">
              {todayData?.greeting_mr || `राम राम, ${displayName}!`}
            </h1>
            <p className="text-xs text-stone-600 font-semibold mt-0.5">
              शेत:{" "}
              <span className="font-bold text-emerald-900">
                {activeParcel
                  ? `${activeParcel.name} (${activeParcel.area_acres} एकर / ${activeParcel.area_gunthas} गुंठे)`
                  : lang === "mr"
                  ? "अजून शेत नकाशावर जोडलेले नाही (No parcel mapped yet)"
                  : "No parcel mapped yet — open My Field Map to draw"}
              </span>
            </p>
          </div>

          <button
            onClick={() => setShowMenu(true)}
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 shadow-sm"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Big "Today" Card */}
        <TodayCard todayData={todayData} lang={lang} />

        {/* 2. Three Mini Cards (Weather, Soil Water, Pests & IPM) */}
        <MiniCards
          weather={weather}
          suitability={suitability}
          risks={risks}
          lang={lang}
        />

        {/* 3. Three Primary Action Buttons (What to Plant, Field Map, Krishi Mitra AI) */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <button
            onClick={() => setShowWhatToPlant(true)}
            className="py-3 px-2 rounded-2xl bg-emerald-800 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs sm:text-base shadow-md flex flex-col items-center justify-center text-center transition-all"
          >
            <Sprout className="w-5 h-5 mb-1 text-emerald-300" />
            <span>{t.what_to_plant_btn}</span>
          </button>

          <button
            onClick={() => setShowMap(true)}
            className="py-3 px-2 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white font-black text-xs sm:text-base shadow-md flex flex-col items-center justify-center text-center transition-all"
          >
            <Map className="w-5 h-5 mb-1 text-emerald-400" />
            <span>{t.my_field_map_btn}</span>
          </button>

          <button
            onClick={() => setShowAssistant(true)}
            className="py-3 px-2 rounded-2xl bg-amber-700 hover:bg-amber-600 active:scale-[0.98] text-white font-black text-xs sm:text-base shadow-md flex flex-col items-center justify-center text-center transition-all"
          >
            <Bot className="w-5 h-5 mb-1 text-amber-200" />
            <span>{t.assistant_btn}</span>
          </button>
        </div>

        {/* 4. Real Field Observation Log ("No data yet. Add today's rain.") */}
        <section className="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 text-xs font-extrabold text-stone-800">
              <CloudRain className="w-4 h-4 text-sky-600" />
              <span>
                {lang === "mr"
                  ? "शेतातील प्रत्यक्ष पर्जन्य व निरीक्षण नोंद"
                  : "Field Rain & Observation Log"}
              </span>
            </div>
            {observations.length === 0 && (
              <span className="text-[11px] text-stone-500 font-semibold">
                {lang === "mr"
                  ? "अजून नोंद नाही. आजचा पाऊस जोडा."
                  : "No data yet. Add today's rain."}
              </span>
            )}
          </div>

          {activeParcel ? (
            <form
              onSubmit={e => handleAddObservation(e, activeParcel.id)}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="number"
                step="0.1"
                min="0"
                max="500"
                value={rainMmInput}
                onChange={e => setRainMmInput(e.target.value)}
                placeholder={lang === "mr" ? "पाऊस (मिमी)" : "Rain (mm)"}
                className="w-28 px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs font-bold"
              />
              <input
                type="text"
                value={obsNoteInput}
                onChange={e => setObsNoteInput(e.target.value)}
                placeholder={
                  lang === "mr"
                    ? "निरीक्षण (उदा. सिंचन केले / कीड पाहणी)"
                    : "Field note (irrigation / scouting)"
                }
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-extrabold"
              >
                {lang === "mr" ? "नोंद जतन करा" : "Log"}
              </button>
            </form>
          ) : (
            <p className="text-xs text-stone-500">
              {lang === "mr"
                ? "पावसाची नोंद करण्यासाठी प्रथम 'माझा शेत नकाशा' उघडून शेताची सीमा जोडा."
                : "Map your first parcel in 'My Field Map' to log daily rainfall observations."}
            </p>
          )}

          {obsStatus && (
            <p className="text-xs text-emerald-800 font-bold mt-1.5">{obsStatus}</p>
          )}

          {observations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-stone-100 flex flex-wrap gap-2 text-[11px] text-stone-600">
              {observations.slice(0, 3).map((o: any) => (
                <span
                  key={o.id}
                  className="bg-stone-100 px-2 py-0.5 rounded-lg font-medium"
                >
                  {o.observed_date}:{" "}
                  <strong>{o.rain_mm !== null ? `${o.rain_mm} mm` : t.no_data}</strong>{" "}
                  {o.notes ? `(${o.notes})` : ""}
                </span>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Persistent Provenance Bar */}
      <footer className="bg-white border-t border-stone-200 py-2 px-4 text-center text-[11px] text-stone-500 font-medium">
        <span>
          {weather?.provenance?.label ||
            "Source: Open-Meteo & ISRIC SoilGrids • Real-time Telemetry"}
        </span>
      </footer>

      {/* What to Plant Modal */}
      {showWhatToPlant && (
        <WhatToPlantModal
          suitability={suitability}
          token={token}
          lang={lang}
          onClose={() => setShowWhatToPlant(false)}
        />
      )}

      {/* Farm Map Modal */}
      {showMap && (
        <FarmMap
          parcels={parcels}
          activeParcel={activeParcel}
          suitability={suitability}
          token={token}
          lang={lang}
          onClose={() => setShowMap(false)}
          onParcelChanged={loadDashboard}
        />
      )}

      {/* Krishi Mitra AI Assistant Modal */}
      {showAssistant && (
        <AssistantChat
          token={token}
          farmer={dashboardData?.farmer || farmer}
          activeParcel={activeParcel}
          lang={lang}
          onClose={() => setShowAssistant(false)}
        />
      )}

      {/* Slide-out Menu Modal */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="bg-white w-4/5 max-w-xs h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
                <span className="font-extrabold text-lg text-emerald-950">
                  मेनू (Menu)
                </span>
                <button onClick={() => setShowMenu(false)} className="text-stone-500">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-2.5 text-sm font-bold text-stone-800">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowAssistant(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 flex items-center space-x-3 text-amber-950"
                >
                  <Bot className="w-5 h-5 text-amber-700" />
                  <span>{t.assistant_btn}</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowWhatToPlant(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 flex items-center space-x-3 text-emerald-900"
                >
                  <Sprout className="w-5 h-5 text-emerald-700" />
                  <span>{t.what_to_plant_btn}</span>
                </button>

                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowMap(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-stone-100 flex items-center space-x-3"
                >
                  <Map className="w-5 h-5 text-stone-600" />
                  <span>{t.my_field_map_btn}</span>
                </button>

                {/* Honest Live Mandi Feed Section (Zero fabricated numbers) */}
                <div className="pt-2 border-t border-stone-100">
                  <div className="text-xs text-stone-600 font-normal p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                    <p className="font-extrabold text-stone-900 mb-1">
                      कृषी उत्पन्न बाजार समिती (Agmarknet):
                    </p>
                    {marketData?.records && marketData.records.length > 0 ? (
                      marketData.records.slice(0, 3).map((rec: any, idx: number) => (
                        <p key={idx} className="text-[11px]">
                          {rec.commodity} ({rec.market}):{" "}
                          <strong>{rec.modal_price_inr_qtl?.display || t.no_data}</strong>
                        </p>
                      ))
                    ) : (
                      <p className="text-[11px] text-stone-500">
                        {t.no_data} — {marketData?.provenance?.label || "Agmarknet feed not configured"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Report a Problem */}
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-stone-100 flex items-center space-x-3 text-stone-700"
                >
                  <MessageSquareWarning className="w-5 h-5 text-amber-600" />
                  <span>समस्या कळवा (Report a Problem)</span>
                </button>

                {/* DPDP Act 2023 Data Portability & Erasure */}
                <div className="pt-2 border-t border-stone-100 space-y-1.5">
                  <span className="block text-[10px] font-extrabold uppercase text-stone-400 px-2">
                    DPDP Act 2023 डेटा अधिकार
                  </span>
                  <button
                    onClick={handleExportMyData}
                    className="w-full text-left p-2 rounded-xl hover:bg-stone-100 flex items-center space-x-2.5 text-xs text-stone-700"
                  >
                    <Download className="w-4 h-4 text-emerald-700" />
                    <span>माझा डेटा डाउनलोड करा (Export JSON)</span>
                  </button>
                  {farmer.role !== "admin" && (
                    <button
                      onClick={handleDeleteMyData}
                      className="w-full text-left p-2 rounded-xl hover:bg-rose-50 flex items-center space-x-2.5 text-xs text-rose-700"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>माझा डेटा व खाते हटवा (Delete My Data)</span>
                    </button>
                  )}
                </div>

                {farmer.role === "admin" && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenAdmin();
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-amber-50 text-amber-900 flex items-center space-x-3"
                  >
                    <span>🛡️ {t.admin_btn}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200">
              <button
                onClick={onLogout}
                className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-700 font-bold text-sm text-center"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report a Problem Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-stone-900">
                समस्या कळवा (Report a Problem)
              </h3>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportSent(false);
                }}
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            {reportSent ? (
              <p className="text-sm font-bold text-emerald-800 py-4">
                धन्यवाद! तुमची तक्रार कृषी अधिकाऱ्याकडे पाठवली आहे.
              </p>
            ) : (
              <form onSubmit={handleSendProblemReport} className="space-y-3">
                <textarea
                  required
                  rows={3}
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="तुमची अडचण किंवा सूचना येथे लिहा..."
                  className="w-full p-3 rounded-2xl border border-stone-300 text-sm font-medium"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-2xl bg-emerald-800 text-white font-bold text-sm"
                >
                  पाठवा (Submit)
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* First-Login DPDP Act 2023 Consent Modal */}
      {!consentAccepted && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-emerald-900">
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
              <h3 className="font-black text-lg">
                डेटा गोपनीयता संमती (DPDP Act 2023)
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
              Kshetra तुमच्या शेताचे स्थान (Polygon), मातीचा प्रकार आणि हवामान माहितीचा वापर केवळ तुम्हाला अचूक कृषी सल्ला देण्यासाठी करते. तुम्ही तुमचा डेटा कधीही डाउनलोड किंवा कायमचा हटवू शकता.
            </p>
            <button
              onClick={handleAcceptConsent}
              className="w-full py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-sm shadow"
            >
              मला मान्य आहे (I Accept &amp; Continue)
            </button>
          </div>
        </div>
      )}

      {/* First-Login Mandatory Password Change Modal */}
      {consentAccepted && mustChangePwd && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-900">
              <KeyRound className="w-6 h-6 text-amber-600" />
              <h3 className="font-black text-lg">
                नवीन पासवर्ड सेट करा (First Login Security)
              </h3>
            </div>
            <p className="text-xs text-stone-600">
              तुमच्या खात्याच्या सुरक्षिततेसाठी ओळखपत्रावरील तात्पुरता पासवर्ड बदलून स्वतःचा नवीन पासवर्ड (किमान ८ अक्षरे) ठेवा.
            </p>
            {pwdMsg && (
              <p className="text-xs font-bold text-rose-700 bg-rose-50 p-2 rounded-xl">
                {pwdMsg}
              </p>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="नवीन पासवर्ड (किमान ८ अक्षरे)"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-300 font-bold text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-sm"
              >
                पासवर्ड अद्ययावत करा (Save New Password)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
