import React, { useState } from "react";
import { Language, translations } from "../i18n/translations";
import {
  X,
  Droplets,
  Calendar,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

interface WhatToPlantModalProps {
  suitability: any;
  token?: string;
  lang: Language;
  activeParcelId?: number | null;
  onCropRecorded?: () => void;
  onClose: () => void;
}

export const WhatToPlantModal: React.FC<WhatToPlantModalProps> = ({
  suitability,
  token,
  lang,
  activeParcelId,
  onCropRecorded,
  onClose
}) => {
  const t = translations[lang];
  const recommendations = suitability?.recommendations || [];
  const season = suitability?.season || "auto";
  const [ratedCrops, setRatedCrops] = useState<Record<string, number>>({});
  const [loggedCropId, setLoggedCropId] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  const handleLogPlantedCrop = async (cropId: string, cropName: string) => {
    if (!token || !activeParcelId) return;
    setLogError(null);
    try {
      const resp = await fetch(`/api/v1/parcels/${activeParcelId}/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          crop_id: cropId,
          crop_name: cropName,
          season: season === "auto" ? "kharif" : season
        })
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d?.error?.message || "Failed to log crop");
      }
      setLoggedCropId(cropId);
      if (onCropRecorded) onCropRecorded();
    } catch (err: any) {
      setLogError(err.message);
    }
  };

  const submitCropFeedback = async (cropId: string, rating: 1 | -1) => {
    setRatedCrops(prev => ({ ...prev, [cropId]: rating }));
    if (!token) return;
    try {
      await fetch("/api/v1/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_type: "crop_recommendation",
          target_ref: cropId,
          rating
        })
      });
    } catch {
      // Ignore network errors
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-emerald-900 text-white rounded-t-3xl">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg sm:text-xl font-bold">{t.top_3_crops}</h2>
            </div>
            <p className="text-xs text-emerald-200 mt-0.5">
              हंगाम (Season): <span className="font-bold uppercase text-white">{season}</span> • माती:{" "}
              <span className="font-bold text-white">{suitability?.soil_type || t.no_data}</span>
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
          {recommendations.length === 0 && (
            <div className="p-6 text-center text-stone-500 font-semibold">
              {t.no_data}
            </div>
          )}

          {recommendations.slice(0, 6).map((crop: any, index: number) => {
            const isTop = index === 0;
            const score = crop.suitability_score ?? 0;
            const bandColor =
              score >= 75
                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                : score >= 55
                ? "bg-amber-100 text-amber-900 border-amber-300"
                : "bg-stone-100 text-stone-800 border-stone-300";

            const breakdown = crop.breakdown || {};
            const currentRating = ratedCrops[crop.crop_id];

            return (
              <div
                key={crop.crop_id}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  isTop
                    ? "border-emerald-600 bg-emerald-50/40 shadow-md ring-2 ring-emerald-500/20"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-full bg-emerald-800 text-white font-extrabold flex items-center justify-center text-sm">
                      #{index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-tight">
                        {crop.names?.[lang] || crop.name}
                      </h3>
                      <p className="text-xs text-stone-500">
                        {crop.names?.en}
                        {crop.scientific_name ? ` (${crop.scientific_name})` : ""} • {crop.band} Fit
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${bandColor}`}>
                      {t.fit} {score}/100
                    </span>
                  </div>
                </div>

                {/* 5-Factor Suitability Breakdown */}
                <div className="grid grid-cols-5 gap-1.5 text-[10px] sm:text-xs bg-stone-100/90 p-2.5 rounded-xl mb-3 text-center">
                  <div>
                    <span className="block text-stone-500">पाणी</span>
                    <span className="font-extrabold text-stone-900">{breakdown.water_match ?? 0}/30</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">माती</span>
                    <span className="font-extrabold text-stone-900">{breakdown.soil_match ?? 0}/25</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">हंगाम</span>
                    <span className="font-extrabold text-stone-900">{breakdown.season_temp_match ?? 0}/20</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">कालावधी</span>
                    <span className="font-extrabold text-stone-900">{breakdown.duration_efficiency ?? 0}/15</span>
                  </div>
                  <div>
                    <span className="block text-stone-500">फेरपालट</span>
                    <span className="font-extrabold text-stone-900">{breakdown.rotation_health ?? 0}/10</span>
                  </div>
                </div>

                {/* Vital Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2 px-3 bg-white border border-stone-200 rounded-xl text-xs font-medium mb-3">
                  <div className="flex items-center space-x-1.5">
                    <Droplets className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>
                      {t.water_need}{" "}
                      <strong className="uppercase">
                        {crop.water_need_mm ? `${crop.water_need_mm} mm` : crop.water_need || t.no_data}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {t.sowing_time} <strong>{crop.duration_days || t.no_data} दिवस</strong>
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500">उत्पादन/एकर: </span>
                    <strong className="text-emerald-900">
                      {crop.expected_yield_qtl_acre ? `${crop.expected_yield_qtl_acre} qtl` : t.no_data}
                    </strong>
                  </div>
                  <div>
                    <span className="text-stone-500">संदर्भ दर: </span>
                    <strong className="text-stone-800">
                      {crop.price_range_inr_qtl?.modal
                        ? `₹${crop.price_range_inr_qtl.modal}/qtl`
                        : t.no_data}
                    </strong>
                  </div>
                </div>

                {/* IPM Guidance & Thumbs Feedback */}
                <div className="bg-white rounded-xl p-3 border border-stone-200 flex items-center justify-between gap-2">
                  <div className="text-xs text-stone-700 flex items-start space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      {typeof crop.ipm_guidance === "string"
                        ? crop.ipm_guidance
                        : suitability?.ipm_disclaimer}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {activeParcelId && token && (
                      <button
                        onClick={() => handleLogPlantedCrop(crop.crop_id, crop.name)}
                        disabled={loggedCropId === crop.crop_id}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center space-x-1 ${
                          loggedCropId === crop.crop_id
                            ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                            : "bg-stone-50 hover:bg-emerald-50 border-stone-300 text-stone-800"
                        }`}
                        title="Record this crop in your parcel's crop rotation ledger"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>
                          {loggedCropId === crop.crop_id
                            ? lang === "mr"
                              ? "नोंदवले"
                              : "Logged"
                            : lang === "mr"
                            ? "पेरणी नोंदवा"
                            : "Log Sown"}
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => submitCropFeedback(crop.crop_id, 1)}
                      className={`p-1.5 rounded-lg border ${
                        currentRating === 1
                          ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                          : "border-stone-200 text-stone-500 hover:bg-stone-50"
                      }`}
                      title="Helpful recommendation"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => submitCropFeedback(crop.crop_id, -1)}
                      className={`p-1.5 rounded-lg border ${
                        currentRating === -1
                          ? "bg-rose-100 border-rose-500 text-rose-800"
                          : "border-stone-200 text-stone-500 hover:bg-stone-50"
                      }`}
                      title="Not suitable for my field"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Disclaimer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 rounded-b-3xl text-center">
          {logError && <p className="text-xs text-rose-700 font-bold mb-1">{logError}</p>}
          <p className="text-xs text-stone-600 font-medium">
            {suitability?.ipm_disclaimer || "Consult your local Krishi Vigyan Kendra (KVK) before applying chemical pesticides."}
          </p>
        </div>
      </div>
    </div>
  );
};
