import { useState } from "react";
import type { Held } from "@/lib/application-store";
import { sound } from "@/lib/sound-effects";

export default function ApplicationReceipt({
  held,
  onAmend,
  onSignOut,
}: {
  held: Held;
  onAmend?: () => void;
  onSignOut?: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("Just now");
  const [copied, setCopied] = useState(false);
  const [shiftAcreage, setShiftAcreage] = useState(35); // percentage to shift

  const farmName = held.app.medical || "Verdant Horizon Farm";
  const operatorName = held.app.fullName || "Farm Operator";
  const region = held.app.country || "Midwest Corn Belt (Iowa, USA)";
  const shiftGoal = held.app.referral || "Shift to Drought-Resilient Sorghum & Soil Moisture Retention";

  const triggerSatelliteSync = () => {
    setSyncing(true);
    sound.playTeleport();

    setTimeout(() => {
      setSyncing(false);
      setLastSync(new Date().toLocaleTimeString());
      sound.playChirp();
    }, 1200);
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(held.ref);
    } catch {
      // ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadReport = () => {
    const reportData = {
      project: "Field Shift: Adapting Farms with NASA Data",
      farmName,
      operatorName,
      region,
      fieldShiftRef: held.ref,
      registeredAt: held.submittedAt,
      nasaTelemetry: {
        smapSoilMoisture: "28.4% volumetric water content",
        ecostressESI: "0.22 evaporative stress index",
        modisNDVI: "0.78 canopy photosynthetic index",
        nasaPowerSolar: "5.8 kWh/m²/day",
        gpmPrecipitationForecast72h: "14.2 mm",
      },
      adaptiveCropShift: {
        recommendedShiftPercentage: `${shiftAcreage}%`,
        waterSavings: `${(shiftAcreage * 0.98).toFixed(1)}%`,
        heatResilienceGain: "+38%",
        soilCarbonRetention: "+19.2%",
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FieldShift_${farmName.replace(/\s+/g, "_")}_NASA_Report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative overflow-hidden p-5 sm:p-7">
      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/30 pb-4">
        <div className="flex items-start gap-3.5">
          {/* User Profile Avatar (Google / GitHub / Initials) */}
          {held.app.avatarUrl ? (
            <img
              src={held.app.avatarUrl}
              alt={operatorName}
              className="h-13 w-13 rounded-2xl border-2 border-emerald-400/80 object-cover shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            />
          ) : (
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-br from-emerald-900 to-teal-950 text-white font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              {operatorName.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-[10.5px] font-mono tracking-wider text-emerald-400 font-bold uppercase">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              NASA Satellite Network · Live Sync
              {held.app.authProvider === "github" && (
                <span className="rounded bg-purple-950/80 px-2 py-0.5 text-[9px] text-purple-300 border border-purple-500/50 flex items-center gap-1">
                  <span>🐙</span> GitHub Verified
                </span>
              )}
              {held.app.authProvider === "google" && (
                <span className="rounded bg-blue-950/80 px-2 py-0.5 text-[9px] text-blue-300 border border-blue-500/50 flex items-center gap-1">
                  <span>🌐</span> Google Verified
                </span>
              )}
            </div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {farmName}
            </h2>
            <p className="text-[12px] text-zinc-300 font-mono">
              Operator: <span className="text-white font-semibold">{operatorName}</span>
              {held.app.githubUsername ? <span className="text-purple-300"> (@{held.app.githubUsername})</span> : null} ·
              Region: <span className="text-cyan-300">{region}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border border-red-700/50 bg-red-950/40 px-3 py-1.5 text-[11px] font-mono text-red-300 hover:bg-red-900/60 hover:text-white transition-all"
              title="Sign Out of Farm Session"
            >
              Sign Out
            </button>
          )}
          <button
            type="button"
            onClick={copyRef}
            className="rounded-lg border border-zinc-700 bg-[#061020] px-3 py-1.5 text-[11px] font-mono text-zinc-300 hover:text-white transition-all"
            title="Click to copy Field Reference ID"
          >
            Ref: <span className="font-bold text-emerald-400">{held.ref}</span> {copied ? "✓ Copied" : ""}
          </button>
          <button
            type="button"
            onClick={triggerSatelliteSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/60 bg-cyan-950/40 px-3.5 py-1.5 text-[11.5px] font-mono font-bold text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:bg-cyan-900/60 hover:text-white transition-all disabled:opacity-50"
          >
            🛰️ {syncing ? "Syncing NASA Orbit..." : `Sync Satellites (${lastSync})`}
          </button>
        </div>
      </div>

      {/* 4 LIVE NASA SATELLITE TELEMETRY CARDS */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* SMAP */}
        <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-[#081a28] to-[#040e16] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 font-bold uppercase">
            <span>NASA SMAP</span>
            <span className="rounded bg-emerald-950 px-1.5 py-0.5 border border-emerald-700/50">L-Band Radar</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">28.4%</span>
            <span className="text-[11px] font-mono text-zinc-400">vol H₂O</span>
          </div>
          <span className="mt-1 block text-[11px] font-medium text-emerald-300">
            Root Zone (0–100cm) Optimal
          </span>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: "72%" }} />
          </div>
        </div>

        {/* ECOSTRESS */}
        <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#08182a] to-[#040e18] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 font-bold uppercase">
            <span>ECOSTRESS (ISS)</span>
            <span className="rounded bg-cyan-950 px-1.5 py-0.5 border border-cyan-700/50">Thermal IR</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">0.22</span>
            <span className="text-[11px] font-mono text-zinc-400">ESI index</span>
          </div>
          <span className="mt-1 block text-[11px] font-medium text-cyan-300">
            Evaporative Stress: Minimal
          </span>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full" style={{ width: "24%" }} />
          </div>
        </div>

        {/* MODIS / Landsat 9 */}
        <div className="rounded-xl border border-amber-500/40 bg-gradient-to-b from-[#1c1808] to-[#0e0c04] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 font-bold uppercase">
            <span>MODIS / Landsat 9</span>
            <span className="rounded bg-amber-950 px-1.5 py-0.5 border border-amber-700/50">Canopy Vigor</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">0.78</span>
            <span className="text-[11px] font-mono text-zinc-400">NDVI</span>
          </div>
          <span className="mt-1 block text-[11px] font-medium text-amber-300">
            High Photosynthetic Density
          </span>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: "78%" }} />
          </div>
        </div>

        {/* NASA POWER Weather */}
        <div className="rounded-xl border border-violet-500/40 bg-gradient-to-b from-[#180a26] to-[#0c0514] p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono text-violet-400 font-bold uppercase">
            <span>NASA POWER &amp; GPM</span>
            <span className="rounded bg-violet-950 px-1.5 py-0.5 border border-violet-700/50">Climatology</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-white">14.2 mm</span>
            <span className="text-[11px] font-mono text-zinc-400">72h rain</span>
          </div>
          <span className="mt-1 block text-[11px] font-medium text-violet-300">
            Solar: 5.8 kWh/m² · 31.2°C High
          </span>
          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full" style={{ width: "65%" }} />
          </div>
        </div>
      </div>

      {/* FIELD SHIFT ADAPTIVE CROP ROTATION PLANNER */}
      <div className="mt-5 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-[#071724]/90 via-[#0a2030]/90 to-[#071724]/90 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/25 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
              🌾 NASA Decision Support Engine
            </span>
            <h3 className="text-lg font-bold text-white">
              Recommended Crop Shift Strategy
            </h3>
          </div>
          <div className="rounded-full bg-emerald-950/80 px-3 py-1 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 font-bold">
            Projected Water Savings: −{(shiftAcreage * 0.98).toFixed(1)}%
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <p className="text-[13px] leading-relaxed text-zinc-200">
              NASA SMAP and ECOSTRESS project a cumulative water deficit for late-summer grain development. 
              By shifting <span className="font-bold text-emerald-300">{shiftAcreage}% of parcel area</span> into drought-resilient 
              <span className="font-bold text-white"> Grain Sorghum and Nitrogen-fixing Legume Cover</span>, your farm preserves 
              groundwater while boosting net profit margins.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <label className="text-[11px] font-mono text-zinc-400 uppercase">
                Acreage To Shift:
              </label>
              <input
                type="range"
                min="10"
                max="80"
                value={shiftAcreage}
                onChange={(e) => setShiftAcreage(Number(e.target.value))}
                className="w-48 accent-emerald-400 cursor-pointer"
              />
              <span className="text-[13px] font-mono font-bold text-emerald-300">
                {shiftAcreage}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-emerald-700/50 bg-[#05141e] p-2.5">
              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Water Preserved</span>
              <span className="text-lg font-black text-emerald-400">−{(shiftAcreage * 0.98).toFixed(1)}%</span>
            </div>
            <div className="rounded-xl border border-cyan-700/50 bg-[#05141e] p-2.5">
              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Heat Resilience</span>
              <span className="text-lg font-black text-cyan-300">+{(shiftAcreage * 1.1).toFixed(0)}%</span>
            </div>
            <div className="rounded-xl border border-amber-700/50 bg-[#05141e] p-2.5">
              <span className="block text-[10px] font-mono text-zinc-400 uppercase">Soil Carbon</span>
              <span className="text-lg font-black text-amber-300">+{(shiftAcreage * 0.52).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={downloadReport}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-[12px] font-mono font-bold text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:brightness-110 active:scale-95 transition-all"
        >
          📥 Download NASA Field Shift Plan (JSON)
        </button>

        <div className="flex items-center gap-3">
          {onAmend && (
            <button
              type="button"
              onClick={onAmend}
              className="rounded-xl border border-zinc-700 bg-[#081224] px-3.5 py-2 text-[12px] font-mono text-zinc-300 hover:text-white transition-all"
            >
              ⚙️ Edit Farm Details
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-xl border border-red-900/60 bg-red-950/30 px-3.5 py-2 text-[12px] font-mono text-red-300 hover:bg-red-900/50 hover:text-white transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
