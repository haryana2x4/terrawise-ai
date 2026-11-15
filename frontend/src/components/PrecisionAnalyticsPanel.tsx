import React, { useEffect, useState } from "react";
import { Language, translations } from "../i18n/translations";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  Droplets,
  Wind,
  Thermometer,
  FlaskConical,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp
} from "lucide-react";

interface PrecisionAnalyticsPanelProps {
  weather: any;
  suitability: any;
  precision: any;
  activeParcel: any;
  token: string;
  lang: Language;
  defaultDistrict?: string;
}

export const PrecisionAnalyticsPanel: React.FC<PrecisionAnalyticsPanelProps> = ({
  weather,
  suitability,
  precision,
  activeParcel,
  token,
  lang,
  defaultDistrict
}) => {
  const [soilProfile, setSoilProfile] = useState<any>(null);
  const [soilLoading, setSoilLoading] = useState(false);
  const t = translations[lang];

  const lat = activeParcel?.centroid_lat || (defaultDistrict === "Nashik" ? 20.0 : 19.39);
  const lon = activeParcel?.centroid_lon || (defaultDistrict === "Nashik" ? 73.79 : 74.65);

  useEffect(() => {
    let active = true;
    setSoilLoading(true);
    fetch(
      `/api/v1/soil?lat=${lat}&lon=${lon}&soil_type=${encodeURIComponent(
        activeParcel?.soil_type || "medium_black"
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => r.json())
      .then(data => {
        if (active) setSoilProfile(data);
      })
      .catch(() => {
        if (active) setSoilProfile(null);
      })
      .finally(() => {
        if (active) setSoilLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, activeParcel?.soil_type, token]);

  const forecast7d = (weather?.forecast_7d || []).map((d: any) => ({
    date: String(d.date || "").slice(5),
    rain_mm: d.rain_mm ?? 0,
    et0_mm: d.et0_mm ?? 0,
    temp_max_c: d.temp_max_c,
    temp_min_c: d.temp_min_c
  }));

  const wb = precision?.water_balance || {};
  const spray = precision?.spray_outlook || {};
  const indices = suitability?.indices || {};
  const proj = precision?.harvest_projection;

  const sprayBadge =
    spray.status === "safe_now"
      ? {
          bg: "bg-emerald-100 text-emerald-900 border-emerald-400",
          label:
            lang === "mr"
              ? "आत्ता फवारणी सुरक्षित (Safe)"
              : lang === "hi"
                ? "अभी छिड़काव सुरक्षित (Safe)"
                : "Optimal Spray Window Now"
        }
      : spray.status === "wait_for_window"
      ? {
          bg: "bg-amber-100 text-amber-900 border-amber-400",
          label:
            lang === "mr"
              ? "पुढील योग्य वेळेची प्रतीक्षा करा"
              : lang === "hi"
                ? "अगले शांत समय की प्रतीक्षा करें"
                : "Wait for Next Calm Window"
        }
      : {
          bg: "bg-rose-100 text-rose-900 border-rose-400",
          label:
            spray.status === "no_data"
              ? t.no_data
              : lang === "mr"
                ? "फवारणी टाळा (वारा/पाऊस)"
                : lang === "hi"
                  ? "छिड़काव टालें (तेज हवा/बारिश)"
                  : "Avoid Spraying (48h Risk)"
        };

  return (
    <div className="space-y-4">
      {/* 1. FAO-56 Parcel Irrigation Water Balance + Liters Calculator */}
      <section className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-emerald-200/80 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                {lang === "mr"
                  ? "FAO-56 अचूक पाणी व सिंचन अंदाज (७ दिवस)"
                  : lang === "hi"
                    ? "FAO-56 सटीक जल एवं सिंचाई संतुलन (7 दिन)"
                    : "FAO-56 Precision Water Balance (7-Day)"}
              </h3>
              <p className="text-[11px] text-stone-500">
                {lang === "mr"
                  ? "ET₀ बाष्पीभवन व प्रत्यक्ष क्षेत्रफळानुसार पाणी गरज (1 mm = 10,000 L/ha)"
                  : lang === "hi"
                    ? "ET₀ वाष्पीकरण और खेत क्षेत्रफल अनुसार जल आवश्यकता (1 mm = 10,000 L/ha)"
                    : "Net crop water volume from ET₀ & mapped hectares (1 mm = 10,000 L/ha)"}
              </p>
            </div>
          </div>

          {activeParcel && (
            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded-full border border-emerald-300">
              {activeParcel.name} · {activeParcel.area_acres} ac ({wb.area_hectares ?? "--"} ha)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 tabular-nums">
          <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200">
            <span className="block text-[11px] text-stone-500 font-semibold">
              {lang === "mr" ? "७ दिवसांचा ET₀" : lang === "hi" ? "7 दिनों का ET₀" : "7-Day ET₀"}
            </span>
            <span className="text-lg font-black text-stone-900">
              {wb.et0_7d_mm?.display || t.no_data}
            </span>
          </div>
          <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200">
            <span className="block text-[11px] text-stone-500 font-semibold">
              {lang === "mr" ? "अपेक्षित पाऊस" : lang === "hi" ? "संभावित बारिश" : "Forecast Rain"}
            </span>
            <span className="text-lg font-black text-sky-800">
              {wb.rain_7d_mm?.display || t.no_data}
            </span>
          </div>
          <div className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200">
            <span className="block text-[11px] text-amber-800 font-semibold">
              {lang === "mr" ? "निव्वळ पाणी तूट" : lang === "hi" ? "शुद्ध सिंचाई कमी" : "Net Water Deficit"}
            </span>
            <span className="text-lg font-black text-amber-950">
              {wb.net_irrigation_deficit_mm?.display || t.no_data}
            </span>
          </div>
          <div className="bg-emerald-900 text-white rounded-2xl p-3">
            <span className="block text-[11px] text-emerald-200 font-semibold">
              {lang === "mr" ? "शेतासाठी दररोज पाणी" : lang === "hi" ? "खेत हेतु दैनिक पानी" : "Daily Plot Volume"}
            </span>
            <span className="text-lg font-black">
              {wb.parcel_liters_per_day !== null && wb.parcel_liters_per_day !== undefined
                ? `${wb.parcel_liters_per_day.toLocaleString()} L`
                : activeParcel
                ? t.no_data
                : lang === "mr"
                ? "शेत आखा"
                : lang === "hi"
                ? "खेत जोड़ें"
                : "Map parcel"}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Recharts 7-Day Hydro-Thermal Forecast Visualization */}
      <section className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
            {lang === "mr"
              ? "७ दिवसांचा पाऊस, बाष्पीभवन (ET₀) व तापमान आलेख"
              : lang === "hi"
                ? "7 दिनों की बारिश, वाष्पीकरण (ET₀) व तापमान चार्ट"
                : "7-Day Rain vs ET₀ Evapotranspiration & Thermal Curve"}
          </h3>
          <span className="text-[10px] text-stone-500 font-medium">Open-Meteo IFS/GFS</span>
        </div>

        {forecast7d.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast7d} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#57534e" }} />
                <YAxis yAxisId="mm" tick={{ fontSize: 11, fill: "#0369a1" }} />
                <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 11, fill: "#b45309" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #d6d3d1",
                    fontSize: "12px"
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar
                  yAxisId="mm"
                  dataKey="rain_mm"
                  name={lang === "mr" ? "पाऊस (mm)" : lang === "hi" ? "बारिश (mm)" : "Rain (mm)"}
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="mm"
                  dataKey="et0_mm"
                  name="ET₀ (mm)"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp_max_c"
                  name={lang === "mr" ? "कमाल °C" : lang === "hi" ? "अधिकतम °C" : "Tmax °C"}
                  stroke="#d97706"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-stone-500 font-semibold">{t.no_data}</div>
        )}
      </section>

      {/* 3. Micrometeorology & Optimal 48h Foliar Spray Windows */}
      <section className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                {lang === "mr"
                  ? "४८ तास फवारणी अचूक वेळ (Precision Spray Window)"
                  : lang === "hi"
                    ? "48 घंटे का सटीक छिड़काव समय (Precision Spray Window)"
                    : "48-Hour Precision Spray Window & Dew Point"}
              </h3>
              <p className="text-[11px] text-stone-500">
                {lang === "mr"
                  ? "वारा < 12 km/h • पाऊस 0 mm • तापमान 14–33.5°C वर आधारित"
                  : lang === "hi"
                    ? "हवा < 12 km/h • बारिश 0 mm • तापमान 14–33.5°C पर आधारित"
                    : "Based on wind < 12 km/h, 0 mm rain, and 14–33.5°C"}
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${sprayBadge.bg}`}>
            {sprayBadge.label}
          </span>
        </div>

        {/* Dew Point & GDD strip */}
        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
          <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
            <span className="text-stone-500 block text-[10px] font-bold">दवबिंदू (Dew Point)</span>
            <span className="font-black text-stone-900 text-sm">
              {precision?.dew_point_c?.display || t.no_data}
            </span>
          </div>
          <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
            <span className="text-stone-500 block text-[10px] font-bold">७-दिवस GDD</span>
            <span className="font-black text-stone-900 text-sm">
              {indices.gdd_7d_base10?.display || t.no_data}
            </span>
          </div>
          <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
            <span className="text-stone-500 block text-[10px] font-bold">योग्य तास (48h)</span>
            <span className="font-black text-emerald-800 text-sm">
              {spray.optimal_hours_count_48h ?? 0} तास
            </span>
          </div>
        </div>

        {spray.next_optimal_hour && (
          <div className="flex items-center space-x-2 text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-emerald-950 font-bold">
            <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              पुढील उत्तम फवारणी वेळ:{" "}
              <span className="font-mono">{spray.next_optimal_hour.replace("T", " ")}</span>
            </span>
          </div>
        )}

        {(spray.hourly_slots || []).length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-[10px] tabular-nums">
            {spray.hourly_slots.slice(0, 8).map((slot: any) => (
              <div
                key={slot.time}
                className={`p-2 rounded-xl border text-center ${
                  slot.spray_ok
                    ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                    : "bg-stone-50 border-stone-200 text-stone-600"
                }`}
              >
                <div className="font-mono font-bold">{String(slot.time).slice(11, 16)}</div>
                <div className="my-0.5 flex justify-center">
                  {slot.spray_ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <div>{slot.wind_kmh ?? "--"} km/h</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. ISRIC SoilGrids 250m & Parcel Yield Projection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <FlaskConical className="w-5 h-5 text-emerald-800" />
              <h3 className="font-extrabold text-sm text-stone-900">
                ISRIC SoilGrids 250m माती घटक
              </h3>
            </div>
            {soilLoading && <span className="text-[11px] text-stone-400">Loading...</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[10px]">माती सामू (Soil pH)</span>
              <span className="font-black text-stone-900">
                {soilProfile?.ph?.available ? soilProfile.ph.display : t.no_data}
              </span>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[10px]">सेंद्रिय कर्ब (SOC)</span>
              <span className="font-black text-stone-900">
                {soilProfile?.organic_carbon_g_kg?.available
                  ? soilProfile.organic_carbon_g_kg.display
                  : t.no_data}
              </span>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[10px]">चिकणमाती (Clay %)</span>
              <span className="font-black text-stone-900">
                {soilProfile?.clay_pct?.available ? soilProfile.clay_pct.display : t.no_data}
              </span>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
              <span className="text-stone-500 block text-[10px]">नायट्रोजन (N)</span>
              <span className="font-black text-stone-900">
                {soilProfile?.nitrogen_g_kg?.available ? soilProfile.nitrogen_g_kg.display : t.no_data}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-stone-500 mt-2">
            {soilProfile?.provenance?.label || "Source: ISRIC SoilGrids 250m (0–5 cm)"}
          </p>
        </section>

        <section className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-stone-200 shadow-md">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="w-5 h-5 text-amber-700" />
            <h3 className="font-extrabold text-sm text-stone-900">
              {lang === "mr"
                ? "शेत उत्पादन व संदर्भ बाजार अंदाज"
                : lang === "hi"
                  ? "खेत उपज एवं संदर्भ बाजार अनुमान"
                  : "Parcel Harvest & Reference Band"}
            </h3>
          </div>

          {proj ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <span className="font-bold text-emerald-950 flex items-center space-x-1.5">
                  <Sprout className="w-4 h-4 text-emerald-700" />
                  <span>{proj.crop_name}</span>
                </span>
                <span className="font-black text-emerald-900 tabular-nums">
                  ~{proj.estimated_yield_quintals ?? "--"} क्विंटल ({proj.area_acres} ac)
                </span>
              </div>

              {proj.reference_price_inr_qtl && (
                <div className="grid grid-cols-2 gap-2 tabular-nums">
                  <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                    <span className="block text-[10px] text-stone-500">MPKV संदर्भ दर/क्विंटल</span>
                    <span className="font-black text-stone-900">
                      ₹{proj.reference_price_inr_qtl.modal} (₹{proj.reference_price_inr_qtl.min}–₹
                      {proj.reference_price_inr_qtl.max})
                    </span>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="block text-[10px] text-amber-800">
                      {lang === "mr" ? "अंदाजित संदर्भ उत्पन्न" : lang === "hi" ? "अनुमानित आय" : "Est. Gross Revenue"}
                    </span>
                    <span className="font-black text-amber-950">
                      {proj.estimated_gross_modal_inr
                        ? `₹${proj.estimated_gross_modal_inr.toLocaleString("en-IN")}`
                        : t.no_data}
                    </span>
                  </div>
                </div>
              )}

              {(proj.key_growth_stages || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {proj.key_growth_stages.map((st: any) => (
                    <span
                      key={st.stage}
                      className="text-[10px] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-lg font-semibold text-stone-700"
                    >
                      Day {st.days_from_sowing}: {st.stage}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-stone-500 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{proj.source}</span>
              </p>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-stone-500 font-semibold bg-stone-50 rounded-2xl border border-stone-200">
              {lang === "mr"
                ? "अचूक उत्पादन व पाणी हिशोबासाठी प्रथम 'माझा शेत नकाशा' मधून तुमचे शेत आखा."
                : lang === "hi"
                  ? "सटीक उपज और सिंचाई गणना के लिए पहले 'खेत का नक्शा' से अपना खेत जोड़ें।"
                  : "Map your field parcel on 'My Field Map' to unlock area-scaled yield and water projections."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
