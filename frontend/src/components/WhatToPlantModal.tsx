import React from "react";
import { Language, translations } from "../i18n/translations";
import { X, CheckCircle, AlertTriangle, Droplets, Calendar, TrendingUp, Sparkles } from "lucide-react";

interface WhatToPlantModalProps {
  advice: any;
  lang: Language;
  onClose: () => void;
}

export const WhatToPlantModal: React.FC<WhatToPlantModalProps> = ({ advice, lang, onClose }) => {
  const t = translations[lang];
  const topCrops = advice?.top_crops || [];
  const season = advice?.season || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-emerald-900 text-white rounded-t-3xl">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg sm:text-xl font-bold">
                {t.top_3_crops}
              </h2>
            </div>
            <p className="text-xs text-emerald-200 mt-0.5">
              हंगाम: <span className="font-bold text-white">{lang === "mr" ? season.name_mr : season.name_en} ({lang === "mr" ? season.months_mr : season.months_en})</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-300 hover:text-white rounded-full hover:bg-emerald-800 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Crops List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {topCrops.map((crop: any, index: number) => {
            const fitLabel = crop.fit?.[lang] || crop.fit?.mr;
            const riskLabel = crop.risk?.[lang] || crop.risk?.mr;
            const isTop = index === 0;

            const fitColor = crop.fit?.en === "Good" 
              ? "bg-emerald-100 text-emerald-900 border-emerald-300" 
              : "bg-amber-100 text-amber-900 border-amber-300";

            const riskColor = crop.risk?.en === "Low" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-300" 
              : (crop.risk?.en === "Medium" ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-rose-50 text-rose-800 border-rose-300");

            return (
              <div
                key={crop.crop_id}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  isTop ? "border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20" : "border-stone-200 bg-white"
                }`}
              >
                {/* Crop Title & Rank */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-full bg-emerald-800 text-white font-extrabold flex items-center justify-center text-sm">
                      #{index + 1}
                    </span>
                    <div>
                      <h3 className="text-xl sm:text-2xl font-black text-stone-900 leading-tight">
                        {crop.marathi_name} ({crop.common_name})
                      </h3>
                      <p className="text-xs text-stone-500 italic">{crop.scientific_name}</p>
                    </div>
                  </div>

                  {/* Fit Badge */}
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${fitColor}`}>
                      {t.fit} {fitLabel}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${riskColor}`}>
                      {t.risk} {riskLabel}
                    </span>
                  </div>
                </div>

                {/* Top 2 Reasons in Plain Words */}
                <div className="mb-3 space-y-1">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                    का निवडावे (Reasons):
                  </span>
                  {(crop.top_reasons?.[lang] || crop.top_reasons?.mr || []).map((reason: string, rIdx: number) => (
                    <div key={rIdx} className="flex items-center space-x-2 text-sm sm:text-base font-semibold text-stone-800">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>

                {/* Vital Statistics Row (At most 3 numbers) */}
                <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-stone-100/80 rounded-xl text-xs sm:text-sm font-medium mb-3">
                  <div>
                    <span className="block text-stone-500 text-[11px] flex items-center space-x-1">
                      <Droplets className="w-3.5 h-3.5 text-blue-500" />
                      <span>{t.water_need}</span>
                    </span>
                    <span className="font-extrabold text-stone-800">{crop.water_need_mm} मिमी</span>
                  </div>

                  <div>
                    <span className="block text-stone-500 text-[11px] flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{t.mandi_price}</span>
                    </span>
                    <span className="font-extrabold text-stone-800">
                      {crop.mandi_price_modal_inr ? `₹${crop.mandi_price_modal_inr}` : t.no_data}
                    </span>
                  </div>

                  <div>
                    <span className="block text-stone-500 text-[11px] flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>कालावधी:</span>
                    </span>
                    <span className="font-extrabold text-stone-800">{crop.duration_days} दिवस</span>
                  </div>
                </div>

                {/* First 3 Things to Do */}
                <div className="bg-white rounded-xl p-3 border border-stone-200">
                  <span className="text-xs font-extrabold text-emerald-900 block mb-1">
                    {t.first_3_things}
                  </span>
                  <ol className="text-xs sm:text-sm space-y-1 text-stone-700">
                    {(crop.first_3_actions?.[lang] || crop.first_3_actions?.mr || []).map((act: string, aIdx: number) => (
                      <li key={aIdx} className="font-medium">
                        {act}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 rounded-b-3xl text-center">
          <p className="text-xs text-stone-500 font-medium">
            {lang === "mr" ? advice?.disclaimer_mr : advice?.disclaimer_en}
          </p>
        </div>
      </div>
    </div>
  );
};
