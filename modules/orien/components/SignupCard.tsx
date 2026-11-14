import { useMemo, useState } from "react";
import { REGIONS } from "@/data/site";
import {
  PASSWORD_RULES,
  passwordScore,
  referenceCode,
  type Application,
} from "@/lib/application";
import { hashPassphrase, saveHeld, type Held } from "@/lib/application-store";

const CROP_OPTIONS = [
  "Corn (Maize) & Soybeans",
  "Wheat & Barley",
  "Paddy Rice & Legumes",
  "Viticulture & Vineyards",
  "Almonds & Tree Nuts",
  "Cotton & Oilseeds",
  "Sorghum & Pearl Millet",
  "Mixed Vegetables & Horticulture",
];

const ADAPTATION_GOALS = [
  "Conserve Groundwater: Shift to Drought-Resilient Sorghum / Millet (-35% water)",
  "Heatwave Survival: ECOSTRESS Thermal Stress & Deficit Drip Irrigation",
  "Soil Regeneration: Legume Nitrogen Fixation & Winter Cover Cropping",
  "Aquifer Recovery: Transition High-Water Paddy to Climate-Adapted Legumes",
];

export default function SignupCard({
  initial,
  onSubmitted,
}: {
  initial?: Application;
  onSubmitted?: (held: Held) => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [farmName, setFarmName] = useState(initial?.medical || "Verdant Horizon Farm");
  const [region, setRegion] = useState(initial?.country || REGIONS[0]);
  const [cropType, setCropType] = useState(CROP_OPTIONS[0]);
  const [shiftGoal, setShiftGoal] = useState(ADAPTATION_GOALS[0]);
  const [hectares, setHectares] = useState("320");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(true);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");

  const score = passwordScore(password);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setError("Please enter your full name or farm operator title.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address for NASA satellite pass notifications.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("Please choose a security password (at least 6 characters).");
      return;
    }
    if (!consent) {
      setError("Please authorize NASA Earth satellite data retrieval for your field parcels.");
      return;
    }

    setError("");
    setStatus("sending");

    const pwHash = await hashPassphrase(password);
    const newApp: Application = {
      fullName: fullName.trim(),
      email: email.trim(),
      password: "",
      confirm: "",
      country: region,
      flight: "SMAP-01",
      seatClass: "orbital",
      medical: farmName.trim() || "Verdant Horizon Farm",
      referral: `${shiftGoal} · ${hectares} Ha · ${cropType}`,
      consent: true,
      updates: true,
    };

    const record: Held = {
      ref: "FS-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      submittedAt: new Date().toISOString(),
      app: newApp,
      pwHash,
    };

    setTimeout(() => {
      saveHeld(record);
      setStatus("idle");
      onSubmitted?.(record);
    }, 1200);
  };

  return (
    <form onSubmit={submit} className="relative overflow-hidden p-5 sm:p-7">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[10.5px] font-mono tracking-[0.2em] uppercase text-cyan-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          Field Shift · Farm Parcel Onboarding
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-[27px]">
          Register Your Farm &amp; Connect NASA Satellites
        </h2>
        <p className="mt-1 text-[13px] text-zinc-300">
          Enter your farm boundary details to automatically ingest NASA SMAP soil moisture, ECOSTRESS thermal data, and crop shift recommendations.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {/* Name and Farm Name */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Farm Operator / Agronomist Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Miller"
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Farm / Enterprise Name
            </label>
            <input
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="e.g. Cedar Creek Precision Ag"
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Email and Field Area */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Contact Email (For Satellite Alerts)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. alex@cedarcreek.farm"
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Total Parcel Area (Hectares)
            </label>
            <input
              type="number"
              value={hectares}
              onChange={(e) => setHectares(e.target.value)}
              placeholder="e.g. 320"
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Agricultural Region */}
        <div>
          <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
            Global Agricultural Region
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white focus:border-cyan-400 focus:outline-none"
          >
            {REGIONS.map((r) => (
              <option key={r} value={r} className="bg-[#081024]">
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Crop & Adaptation Goal */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Current Primary Crop
            </label>
            <select
              value={cropType}
              onChange={(e) => setCropType(e.target.value)}
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white focus:border-cyan-400 focus:outline-none"
            >
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c} className="bg-[#081024]">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
              Target Adaptive Shift Goal
            </label>
            <select
              value={shiftGoal}
              onChange={(e) => setShiftGoal(e.target.value)}
              className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[12.5px] text-white focus:border-cyan-400 focus:outline-none"
            >
              {ADAPTATION_GOALS.map((g) => (
                <option key={g} value={g} className="bg-[#081024]">
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-[10.5px] font-mono tracking-wider text-zinc-300 uppercase font-semibold mb-1">
            Account Password / Security Passphrase
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose account password"
            className="w-full rounded-xl border border-zinc-700/70 bg-[#050b18] px-3.5 py-2 text-[13px] text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Consent Authorization */}
        <div className="flex items-start gap-2.5 rounded-xl border border-cyan-800/40 bg-[#040e1d]/80 p-3 text-[12px] text-cyan-200">
          <input
            type="checkbox"
            id="auth-consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-cyan-500 text-cyan-600 focus:ring-cyan-500"
          />
          <label htmlFor="auth-consent" className="cursor-pointer leading-relaxed">
            Authorize Field Shift to query NASA SMAP (Soil Moisture), ECOSTRESS (Evapotranspiration), and NASA POWER datasets for your parcel coordinates.
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-[12px] text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 py-3 text-[13px] font-mono font-bold tracking-wider uppercase text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {status === "sending" ? "Mapping Farm Coordinates..." : "Register Farm & Launch Satellite Dashboard"}
        </button>
      </div>
    </form>
  );
}
