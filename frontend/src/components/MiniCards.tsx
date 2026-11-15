import React, { useState } from "react";
import { Language, translations } from "../i18n/translations";
import { CloudSun, Droplets, Bug, ChevronDown, ChevronUp } from "lucide-react";

interface MiniCardsProps {
  weather: any;
  suitability?: any;
  risks?: any;
  lang: Language;
}

export const MiniCards: React.FC<MiniCardsProps> = ({
  weather,
  suitability,
  risks,
  lang
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const t = translations[lang];

  const curr = weather?.current || {};
  const tempObj = curr.temperature_c || curr.temperature || {};
  const tempVal = tempObj.value ?? null;
  const tempDisplay = tempVal !== null ? `${tempVal} °C` : t.no_data;

  const rainObj = curr.precipitation_mm || curr.precipitation_now_mm || {};
  const rainVal = rainObj.value ?? null;
  const rainDisplay = rainVal !== null ? `${rainVal} mm` : t.no_data;

  const smObj = curr.soil_moisture_m3m3 || curr.soil_root_hydration_pct || {};
  const smVal = smObj.value ?? null;
  const smDisplay = smVal !== null ? `${smVal} ${smObj.unit || "m³/m³"}` : t.no_data;

  const windObj = curr.wind_kmh || curr.wind_speed_kmh || {};
  const windDisplay = windObj.value !== null && windObj.value !== undefined ? `${windObj.value} km/h` : t.no_data;

  const vpdObj = suitability?.indices?.vpd_kpa || {};
  const vpdDisplay = vpdObj.value !== null && vpdObj.value !== undefined ? `${vpdObj.value} kPa` : t.no_data;

  const rshiObj = suitability?.indices?.rshi_score || {};
  const rshiVal = rshiObj.value ?? null;
  const rshiDisplay = rshiVal !== null ? `${rshiVal}/100` : t.no_data;

  const provLabel = weather?.provenance?.label || t.no_data;

  // Temperature word badge
  let tempWord = t.no_data;
  let tempIconColor = "text-stone-500";
  if (tempVal !== null) {
    if (tempVal < 16) {
      tempWord = t.temp_cool;
      tempIconColor = "text-blue-600";
    } else if (tempVal > 35) {
      tempWord = t.temp_hot;
      tempIconColor = "text-rose-600";
    } else {
      tempWord = t.temp_good;
      tempIconColor = "text-emerald-600";
    }
  }

  // Soil water 3-step meter
  let soilWord = t.no_data;
  let soilMeterStep = 0;
  if (rshiVal !== null) {
    if (rshiVal < 35) {
      soilWord = t.soil_dry;
      soilMeterStep = 1;
    } else if (rshiVal > 75) {
      soilWord = t.soil_wet;
      soilMeterStep = 3;
    } else {
      soilWord = t.soil_good;
      soilMeterStep = 2;
    }
  }

  const alerts = risks?.alerts || [];
  const firstAlert = alerts[0] || null;
  const pestWord =
    weather?.status === "unavailable"
      ? t.no_data
      : firstAlert
      ? firstAlert.title
      : lang === "mr"
      ? "नियमित IPM पाहणी करा"
      : lang === "hi"
      ? "नियमित IPM निगरानी करें"
      : "Routine IPM Scouting";

  const toggleExpand = (card: string) => {
    setExpandedCard(prev => (prev === card ? null : card));
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

          <div className="my-2">
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-stone-900">{tempDisplay}</span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              {lang === "mr" ? "पाऊस:" : lang === "hi" ? "बारिश:" : "Rain:"}{" "}
              <span className="font-bold text-stone-800">{rainDisplay}</span>
            </p>
          </div>
        </div>

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
              <p className="flex justify-between">
                <span>{lang === "mr" ? "वारा:" : lang === "hi" ? "हवा की गति:" : "Wind:"}</span>{" "}
                <span className="font-bold">{windDisplay}</span>
              </p>
              <p className="flex justify-between">
                <span>{lang === "mr" ? "बाष्पीभवन ताण (VPD):" : lang === "hi" ? "वाष्पोत्सर्जन दबाव (VPD):" : "VPD Stress:"}</span>{" "}
                <span className="font-bold">{vpdDisplay}</span>
              </p>
              <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200">
                {provLabel}
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

          <div className="my-2">
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                {rshiDisplay}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              {lang === "mr" ? "ओलावा (0–7cm):" : lang === "hi" ? "नमी (0–7cm):" : "Moisture (0–7cm):"}{" "}
              <span className="font-bold text-stone-800">{smDisplay}</span>
            </p>

            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <div className={`h-2 rounded-full ${soilMeterStep >= 1 ? "bg-amber-400" : "bg-stone-200"}`} />
              <div className={`h-2 rounded-full ${soilMeterStep >= 2 ? "bg-emerald-500" : "bg-stone-200"}`} />
              <div className={`h-2 rounded-full ${soilMeterStep >= 3 ? "bg-blue-500" : "bg-stone-200"}`} />
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
              <p className="flex justify-between">
                <span>
                  {lang === "mr"
                    ? "७ दिवसांचा पाऊस अंदाज:"
                    : lang === "hi"
                      ? "7 दिनों की बारिश अनुमान:"
                      : "7-Day Rain Forecast:"}
                </span>
                <span className="font-bold">
                  {weather?.summary?.rain_7d_forecast_mm !== null && weather?.summary?.rain_7d_forecast_mm !== undefined
                    ? `${weather.summary.rain_7d_forecast_mm} mm`
                    : t.no_data}
                </span>
              </p>
              <p className="flex justify-between">
                <span>
                  {lang === "mr"
                    ? "मागील ३० दिवसांचा पाऊस:"
                    : lang === "hi"
                      ? "पिछले 30 दिनों की बारिश:"
                      : "30-Day Past Rain:"}
                </span>
                <span className="font-bold">
                  {weather?.summary?.rain_30d_total_mm !== null && weather?.summary?.rain_30d_total_mm !== undefined
                    ? `${weather.summary.rain_30d_total_mm} mm`
                    : t.no_data}
                </span>
              </p>
              <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200">
                {provLabel}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Pest & IPM Mini Card */}
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
            <span className="text-base sm:text-lg font-extrabold text-stone-900 block leading-snug">
              {pestWord}
            </span>
            <p className="text-xs text-stone-600 font-medium mt-1 line-clamp-2">
              {firstAlert
                ? firstAlert.action
                : lang === "mr"
                ? "पिवळे व निळे चिकट सापळे लावून किडींचे निरीक्षण करा."
                : lang === "hi"
                ? "पीले और नीले चिपचिपे ट्रैप लगाकर कीटों की निगरानी करें।"
                : "Deploy yellow/blue sticky traps and scout canopy."}
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
              <p className="text-[11px] text-emerald-900 font-semibold">
                {risks?.ipm_disclaimer || "Consult your local KVK before chemical pesticide application."}
              </p>
              <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-200">
                {provLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
