import React, { useState, useEffect } from "react";
import { Language, translations } from "../i18n/translations";
import { Header } from "../components/Header";
import { TodayCard } from "../components/TodayCard";
import { MiniCards } from "../components/MiniCards";
import { WhatToPlantModal } from "../components/WhatToPlantModal";
import { FarmMap } from "../components/FarmMap";
import { Sprout, Map, HelpCircle, History, Menu, X, TrendingUp } from "lucide-react";

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
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"home" | "prices" | "help">("home");

  const t = translations[lang];

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const resp = await fetch("/api/farmer/dashboard", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
          setDashboardData(data);
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full border-4 border-emerald-800 border-t-transparent animate-spin mb-4"></div>
        <p className="font-bold text-emerald-950 text-lg">माहिती लोड होत आहे...</p>
        <p className="text-xs text-stone-500 mt-1">Fetching live weather &amp; soil satellite data</p>
      </div>
    );
  }

  const todayData = dashboardData?.today_card;
  const weather = dashboardData?.weather;
  const advice = dashboardData?.advice;
  const parcels = dashboardData?.parcels || [];
  const activeParcel = todayData?.active_parcel || parcels[0] || null;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <Header
        farmer={farmer}
        lang={lang}
        onLanguageChange={onLanguageChange}
        onLogout={onLogout}
        onOpenAdmin={farmer.role === "admin" ? onOpenAdmin : undefined}
      />

      {/* Main Single-Screen Content (Fit for 360px phones with no scrolling required) */}
      <main className="max-w-md sm:max-w-xl md:max-w-2xl w-full mx-auto px-3.5 sm:px-6 py-3 flex-1 flex flex-col justify-between space-y-3">
        {/* Farmer Greeting & Parcel Badge */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900 leading-tight">
              {todayData?.greeting_mr || `राम राम, ${farmer.full_name}!`}
            </h1>
            <p className="text-xs text-stone-600 font-semibold mt-0.5">
              शेत: <span className="font-bold text-emerald-900">{activeParcel ? `${activeParcel.village} (${activeParcel.area_acre} एकर)` : "नोंदणीकृत जमीन"}</span>
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

        {/* 1. Big "Today" Card for the Field */}
        <TodayCard todayData={todayData} lang={lang} />

        {/* 2. Three Mini Cards (Weather, Soil Water, Pests) */}
        <MiniCards weather={weather} diagnostics={advice?.diagnostics} lang={lang} />

        {/* 3. Two Big Prominent Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => setShowWhatToPlant(true)}
            className="py-3.5 px-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-base sm:text-lg shadow-md shadow-emerald-900/20 flex flex-col items-center justify-center text-center transition-all border border-emerald-900"
          >
            <Sprout className="w-6 h-6 mb-1 text-emerald-300" />
            <span>{t.what_to_plant_btn}</span>
          </button>

          <button
            onClick={() => setShowMap(true)}
            className="py-3.5 px-3 rounded-2xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white font-black text-base sm:text-lg shadow-md shadow-stone-900/20 flex flex-col items-center justify-center text-center transition-all border border-stone-800"
          >
            <Map className="w-6 h-6 mb-1 text-emerald-400" />
            <span>{t.my_field_map_btn}</span>
          </button>
        </div>
      </main>

      {/* Persistent Bottom Bar with Provenance */}
      <footer className="bg-white border-t border-stone-200 py-2 px-4 text-center text-[11px] text-stone-500 font-medium">
        <span>स्रोत: Open-Meteo &amp; NASA POWER • {weather?.observed_at_str || "अद्ययावत माहिती"}</span>
      </footer>

      {/* What to Plant Modal */}
      {showWhatToPlant && (
        <WhatToPlantModal
          advice={advice}
          lang={lang}
          onClose={() => setShowWhatToPlant(false)}
        />
      )}

      {/* Farm Map Screen */}
      {showMap && (
        <FarmMap
          parcels={parcels}
          activeParcel={activeParcel}
          advice={advice}
          lang={lang}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Slide-out Menu Modal */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="bg-white w-4/5 max-w-xs h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
                <span className="font-extrabold text-lg text-emerald-950">मेनू (Menu)</span>
                <button onClick={() => setShowMenu(false)} className="text-stone-500">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-3 text-base font-bold text-stone-800">
                <button
                  onClick={() => { setShowMenu(false); setShowWhatToPlant(true); }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 flex items-center space-x-3 text-emerald-900"
                >
                  <Sprout className="w-5 h-5 text-emerald-700" />
                  <span>{t.what_to_plant_btn}</span>
                </button>

                <button
                  onClick={() => { setShowMenu(false); setShowMap(true); }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-stone-100 flex items-center space-x-3"
                >
                  <Map className="w-5 h-5 text-stone-600" />
                  <span>{t.my_field_map_btn}</span>
                </button>

                <div className="pt-2 border-t border-stone-100">
                  <div className="text-xs text-stone-500 font-normal p-2">
                    <p className="font-bold text-stone-800">लासलगाव / पिंपळगाव बाजारभाव:</p>
                    <p>कांदा: ₹१,८०० - ₹२,४०० / क्विंटल</p>
                    <p>द्राक्षे: ₹४,५०० - ₹६,००० / क्विंटल</p>
                  </div>
                </div>

                {farmer.role === "admin" && (
                  <button
                    onClick={() => { setShowMenu(false); onOpenAdmin(); }}
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
                className="w-full py-3 rounded-xl bg-rose-50 text-rose-700 font-bold text-sm text-center"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
