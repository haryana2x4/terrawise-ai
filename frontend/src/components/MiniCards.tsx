import React, { useState } from "react";
import { Language, translations } from "../i18n/translations";
import { CloudSun, Droplets, Bug, ChevronDown, ChevronUp, Wind, Thermometer, ShieldCheck } from "lucide-react";

interface MiniCardsProps {
  weather: any;
  diagnostics: any;
  lang: Language;
}

export const MiniCards: React.FC<MiniCardsProps> = ({ weather, diagnostics, lang }) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const t = translations[lang];

  const curr = weather?.current || {};
  const tempVal = curr.temperature?.value;
  const tempDisplay = curr.temperature?.display?.[lang] || t.no_data;
  const rainNow = curr.precipitation_now_mm?.display?.[lang] || "0";
  const soilWaterVal = curr.soil_root_hydration_pct?.value;
  const soilWaterDisplay = curr.soil_root_hydration_pct?.display?.[lang] || t.no_data;
  const vpdVal = curr.vpd_kpa?.display?.[lang] || t.no_data;
  const windVal = curr.wind_speed_kmh?.display?.[lang] || t.no_data;

  // Temperature word badge
  let tempWord = t.temp_good;
  let tempIconColor = "text-emerald-600";
  if (tempVal !== null && tempVal !== undefined) {
    if (tempVal < 16) {
      tempWord = t.temp_cool;
      tempIconColor = "text-blue-600";
    } else if (tempVal > 33) {
      tempWord = t.temp_hot;
      tempIconColor = "text-rose-600";
    }
  }

  // Soil water 3-step meter word badge
  let soilWord = t.soil_good;
  let soilMeterStep = 2; // 1: dry, 2: good, 3: wet
  if (soilWaterVal !== null && soilWaterVal !== undefined) {
    if (soilWaterVal < 35) {
      soilWord = t.soil_dry;
      soilMeterStep = 1;
    } else if (soilWaterVal > 75) {
      soilWord = t.soil_wet;
      soilMeterStep = 3;
    }
  }

  // Pest risk badge
  const pestDiag = diagnostics?.pest_risk || {};
  const pestWord = lang === "mr" ? (pestDiag.label_mr || "कमी धोका") : (pestDiag.label_en || "Low Risk");

  const toggleExpand = (card: string) => {
    setExpandedCard(prev => prev === card ? null : card);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 1. Weather Mini Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-xl bg-blue-50 ${tempIconColor}`}>
                <CloudSun className="w-6 h-6" />
              </div>
              <span className="font-bold text-stone-700 text-base">{t.weather_card}</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
              {tempWord}
            </span>
          </div>

          {/* At most 3 numbers */}
          <div className="my-2">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-stone-900">{tempDisplay}</span>
              <span className="text-base font-bold text-stone-500">°C</span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              पाऊस: <span className="font-bold text-stone-800">{rainNow} मिमी</span>
            </p>
          </div>
        </div>

        {/* Expand for expert detail */}
        <div>
          <button
            onClick={() => toggleExpand("weather")}
            className="w-full text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center justify-between pt-2 border-t border-stone-100"
          >
            <span>{t.more_details}</span>
            {expandedCard === "weather" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedCard === "weather" && (
            <div className="mt-2 pt-2 text-xs space-y-1.5 text-stone-600 bg-stone-50 p-2 rounded-lg">
              <p className="flex justify-between"><span>वारा (Wind):</span> <span className="font-bold">{windVal} km/h</span></p>
              <p className="flex justify-between"><span>बाष्पीभवन ताण (VPD):</span> <span className="font-bold">{vpdVal} kPa</span></p>
              <p className="text-[11px] text-stone-400 pt-1 border-t border-stone-200">
                {t.source_label} {weather?.source || "Open-Meteo"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Soil Water Mini Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Droplets className="w-6 h-6" />
              </div>
              <span className="font-bold text-stone-700 text-base">{t.soil_water_card}</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
              {soilWord}
            </span>
          </div>

          {/* 3-Step Meter Visual + Percentage */}
          <div className="my-2">
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-extrabold text-stone-900">{soilWaterDisplay}</span>
              <span className="text-base font-bold text-stone-500">%</span>
            </div>
            
            {/* Visual 3-step gauge bar */}
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className={`h-2 rounded-full ${soilMeterStep >= 1 ? "bg-amber-400" : "bg-stone-200"}`} title="कोरडी (Dry)"></div>
              <div className={`h-2 rounded-full ${soilMeterStep >= 2 ? "bg-emerald-500" : "bg-stone-200"}`} title="उत्तम (Good)"></div>
              <div className={`h-2 rounded-full ${soilMeterStep >= 3 ? "bg-blue-500" : "bg-stone-200"}`} title="जास्त पाणी (Wet)"></div>
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => toggleExpand("soil")}
            className="w-full text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center justify-between pt-2 border-t border-stone-100"
          >
            <span>{t.more_details}</span>
            {expandedCard === "soil" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedCard === "soil" && (
            <div className="mt-2 pt-2 text-xs space-y-1.5 text-stone-600 bg-stone-50 p-2 rounded-lg">
              <p className="flex justify-between"><span>वरचा थर (0-7cm):</span> <span className="font-bold">{curr.soil_top_hydration_pct?.display?.[lang] || t.no_data}%</span></p>
              <p className="flex justify-between"><span>मुळांची कक्षा (28-100cm):</span> <span className="font-bold">{curr.soil_root_hydration_pct?.display?.[lang] || t.no_data}%</span></p>
              <p className="text-[11px] text-stone-400 pt-1 border-t border-stone-200">
                {t.source_label} Open-Meteo & NASA MERRA-2
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pest & Disease Mini Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Bug className="w-6 h-6" />
              </div>
              <span className="font-bold text-stone-700 text-base">{t.pest_card}</span>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              IPM
            </span>
          </div>

          <div className="my-2">
            <span className="text-xl font-extrabold text-stone-900 block leading-tight">
              {pestWord}
            </span>
            <p className="text-xs text-stone-600 font-medium mt-1 line-clamp-2">
              {lang === "mr" ? pestDiag.text_mr : pestDiag.text_en}
            </p>
          </div>
        </div>

        <div>
          <button
            onClick={() => toggleExpand("pest")}
            className="w-full text-xs text-emerald-800 hover:text-emerald-950 font-bold flex items-center justify-between pt-2 border-t border-stone-100"
          >
            <span>{t.more_details}</span>
            {expandedCard === "pest" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedCard === "pest" && (
            <div className="mt-2 pt-2 text-xs space-y-1.5 text-stone-600 bg-stone-50 p-2 rounded-lg">
              <p><b>कारवाई:</b> {lang === "mr" ? pestDiag.action_mr : pestDiag.action_en}</p>
              <p className="text-[11px] text-emerald-800 font-semibold pt-1 border-t border-stone-200">
                सल्ला: रासायनिक फवारणीपूर्वी KVK चा सल्ला घ्या.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
