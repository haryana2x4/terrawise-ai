import { useEffect, useState } from "react";
import LoginPortal from "@/components/LoginPortal";
import LuminousSwarm from "@/components/LuminousSwarm";
import OrbitalScene from "@/components/OrbitalScene";
import ScreenEnderman from "@/components/ScreenEnderman";
import EnderDragonFlight from "@/components/EnderDragonFlight";
import PointCloudBrain from "@/components/PointCloudBrain";
import { sound } from "@/lib/sound-effects";
import { orionVoice } from "@/lib/orion-voice";
import { translator, SUPPORTED_LANGUAGES } from "@/lib/translator";
import { nextWindow, TELEMETRY, PROGRAM_STATS, VOICES, FAQ, type FaqItem } from "@/data/site";

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      {/* Field Shift: NASA Earth & Sprout Logo */}
      <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 drop-shadow-[0_0_12px_rgba(16,185,129,0.7)]" aria-hidden="true">
        <defs>
          <linearGradient id="fs-earth" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="fs-orbit" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        {/* Planet Earth Base */}
        <circle cx="18" cy="18" r="8" fill="none" stroke="url(#fs-earth)" strokeWidth="2.4" />
        {/* Satellite Orbit Ellipse */}
        <ellipse
          cx="18"
          cy="18"
          rx="15"
          ry="5.5"
          fill="none"
          stroke="url(#fs-orbit)"
          strokeWidth="1.8"
          transform="rotate(-26 18 18)"
          strokeDasharray="4 2"
          opacity="0.95"
        />
        {/* Satellite Sensor Point */}
        <circle cx="30" cy="12" r="2" fill="#38bdf8" className="animate-pulse" />
        {/* Sprout Leaf in Center */}
        <path
          d="M18 13.5 C15.5 13.5 14 16 14 18 C14 20.5 16 22 18 22 C20 22 22 20.5 22 18 C22 16 20.5 13.5 18 13.5 Z"
          fill="#10b981"
          opacity="0.85"
        />
        <path d="M18 15 L18 22" stroke="#dcfce7" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <div>
        <div className="flex items-center gap-2">
          <span className="block text-[15px] font-black tracking-[0.24em] text-foreground uppercase bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm">
            Field Shift
          </span>
          <span className="rounded bg-emerald-950/80 px-1.5 py-0.2 text-[8.5px] font-mono font-bold text-emerald-300 border border-emerald-600/40">
            NASA DATA
          </span>
        </div>
        <span className="block text-[9.5px] font-mono tracking-[0.16em] text-cyan-200 uppercase">
          Adapting Farms with NASA Earth Observations
        </span>
      </div>
    </div>
  );
}

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, target - now);
  return {
    d: String(Math.floor(ms / 86_400_000)).padStart(2, "0"),
    h: String(Math.floor(ms / 3_600_000) % 24).padStart(2, "0"),
    m: String(Math.floor(ms / 60_000) % 60).padStart(2, "0"),
    s: String(Math.floor(ms / 1000) % 60).padStart(2, "0"),
  };
}

export default function App() {
  const [muted, setMuted] = useState(() => sound.isMuted());
  const [voyageValue, setVoyageValue] = useState(0.35);
  const [brainModalOpen, setBrainModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState(() => translator.getLanguage());
  const flight = nextWindow(Date.now());
  const countdown = useCountdown(Date.parse(flight.window));

  useEffect(() => {
    const handleOpenBrain = () => setBrainModalOpen(true);
    window.addEventListener("open:brain", handleOpenBrain);
    const unsub = translator.subscribe((l) => setSelectedLang(l));
    return () => {
      window.removeEventListener("open:brain", handleOpenBrain);
      unsub();
    };
  }, []);

  const toggleAudio = () => {
    const next = sound.toggleMute();
    setMuted(next);
  };

  const summonDragon = () => {
    window.dispatchEvent(new CustomEvent("orion:dragon"));
  };

  const handleVoyageSlider = (val: number) => {
    setVoyageValue(val);
    window.dispatchEvent(new CustomEvent("voyage:progress", { detail: { progress: val } }));
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-foreground select-none flex flex-col justify-between bg-[#030814]">
      {/* 1. CINEMATIC BACKGROUND: Luminous Orange & Blue Particle Swarm (Singularity -> Spiral Galaxy) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep Cosmic Backdrop with subtle Earth night lights */}
        <img
          src="/images/earth-night-lights.jpg"
          alt="Earth satellite night lights"
          className="h-full w-full object-cover object-center brightness-75 contrast-125 opacity-35"
          fetchPriority="high"
        />

        {/* Deep Space Vignettes */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030814f5] via-[#040e1ff0] to-[#030814fc]" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_40%,rgba(16,185,129,0.14)_0%,rgba(6,182,212,0.18)_40%,#030814_92%)]" />

        {/* 🌟 LUMINOUS ORANGE & BLUE SWARM - Drifting & Reshaping through space as you scroll */}
        <LuminousSwarm externalProgress={voyageValue} />

        {/* Holographic Agricultural GIS Grid Scanlines */}
        <div className="absolute inset-0 hud-scanlines opacity-25" />
        <div className="absolute inset-0 hud-grid opacity-20 [mask-image:radial-gradient(75%_65%_at_50%_40%,#000_0%,transparent_100%)]" />
      </div>

      {/* 2. 3D Tilting Orbital Scene */}
      <div className="pointer-events-none fixed top-1/2 right-[-10%] z-10 h-[min(960px,110vw)] w-[min(960px,110vw)] -translate-y-1/2 opacity-75 lg:right-[1%]">
        <OrbitalScene />
      </div>

      {/* 3. Top Header Navigation */}
      <header className="relative z-30 flex items-center justify-between border-b border-emerald-500/25 bg-[#030a16]/90 px-6 py-4 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        <Wordmark />

        <div className="flex items-center gap-3">
          {/* Swarm Metamorphosis Slider (Single Point -> Spiral Galaxy) */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-orange-500/35 bg-[#061224]/85 px-3.5 py-1.5 text-[11px] font-mono shadow-[0_0_12px_rgba(249,115,22,0.25)]">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
            <span className="text-orange-300 font-bold">SWARM VOYAGE:</span>
            <span className="text-zinc-400 text-[10px]">Point of Light</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={voyageValue}
              onChange={(e) => handleVoyageSlider(parseFloat(e.target.value))}
              className="w-24 accent-orange-400 cursor-pointer"
              title="Reshape cosmic swarm: Single Point of Light ↔ Vast Spiral Galaxy"
            />
            <span className="text-cyan-300 font-bold text-[10px]">Spiral Galaxy</span>
          </div>

          {/* Live NASA Satellite Status Badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-1.5 text-[11px] font-mono text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            NASA SMAP &amp; ECOSTRESS · LIVE
          </div>

          {/* Gemma 4 Brain Visualizer Button */}
          <button
            type="button"
            onClick={() => setBrainModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/70 bg-gradient-to-r from-cyan-950/90 to-blue-950/90 px-3.5 py-1.5 text-[11.5px] font-mono font-bold text-cyan-200 hover:text-white shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all"
            title="Visualize Gemma 4 Point-Cloud Brain Scan"
          >
            🧠 <span className="hidden sm:inline">Gemma 4 Brain</span>
          </button>

          {/* Universal Language & Better Voice Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-cyan-500/50 bg-[#061120]/90 px-2.5 py-1 text-[11px] font-mono shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <span className="text-[12px]">🌐</span>
            <select
              value={selectedLang}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedLang(val);
                translator.setLanguage(val);
                sound.playChirp();
              }}
              className="bg-transparent font-bold text-cyan-200 outline-none cursor-pointer max-w-[100px] sm:max-w-[130px] truncate"
              title="Global Language & Voice Translation"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#040c1a] text-white">
                  {l.flag} {l.nativeName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                sound.playChirp();
                orionVoice.previewVoice(selectedLang);
              }}
              className="rounded px-1.5 py-0.5 bg-cyan-950/80 hover:bg-cyan-800 text-cyan-300 border border-cyan-500/40 text-[10px]"
              title="Preview Voice in selected language"
            >
              🔊
            </button>
          </div>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-[11.5px] font-mono tracking-wider transition-all ${
              muted
                ? "border-red-900/60 bg-red-950/40 text-red-300"
                : "border-emerald-600/80 bg-emerald-950/40 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
            }`}
            title="Toggle Voice & Sound Effects"
          >
            {muted ? "🔇 Muted" : "🔊 Audio Online"}
          </button>

          {/* Aerial Survey / Ender Dragon Flight */}
          <button
            type="button"
            onClick={summonDragon}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/80 bg-gradient-to-r from-purple-950/80 to-indigo-950/80 px-4 py-1.5 text-[11.5px] font-mono font-bold text-purple-100 hover:from-purple-900 hover:to-indigo-900 hover:text-white transition-all shadow-[0_0_22px_rgba(168,85,247,0.45)]"
            title="Summon Aerial Drone & Dragon Survey (Key 'D')"
          >
            🐉 <span className="hidden sm:inline">Aerial Survey (D)</span>
          </button>
        </div>
      </header>

      {/* 4. MAIN CONTENT CONTAINER (Scrollable for full cinematic swarm voyage) */}
      <main className="relative z-20 flex-1 flex flex-col items-center px-4 py-8 sm:px-6">
        {/* HERO SECTION: NASA Overpass Banner & Farm Access Terminal */}
        <div className="w-full max-w-[560px]">
          {/* Next NASA Satellite Pass Banner */}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-[#061826]/95 via-[#082236]/95 to-[#061826]/95 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_28px_rgba(16,185,129,0.22)] backdrop-blur-2xl">
            <div>
              <span className="flex items-center gap-1.5 text-[10.5px] font-mono tracking-[0.2em] text-emerald-300 uppercase font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                NEXT NASA SATELLITE PASS
              </span>
              <span className="mt-0.5 block text-[14px] font-semibold text-white">
                {flight.mission} · <span className="text-cyan-300 font-mono text-[12px]">{flight.vehicle}</span>
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[15px] text-emerald-200 font-bold bg-[#04121d]/90 px-3 py-1.5 rounded-xl border border-emerald-500/60 shadow-inner">
              <span>{countdown.d}d</span>
              <span>{countdown.h}h</span>
              <span>{countdown.m}m</span>
              <span className="text-cyan-400 animate-pulse">{countdown.s}s</span>
            </div>
          </div>

          {/* The Farm Access & Registration Portal */}
          <div className="relative rounded-3xl border border-emerald-500/40 bg-[#061122]/95 shadow-[0_24px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-2xl">
            <LoginPortal />
          </div>

          {/* Live NASA Agri-Telemetry Facts Row */}
          <div className="mt-3.5 flex items-center justify-between px-2 text-[10.5px] font-mono text-cyan-200">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              GROUNDWATER: −34.6% SAVED
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              SATELLITES: 6 CONSTELLATIONS
            </span>
            <span className="text-amber-300 font-semibold">NASA SPACE APPS 2026</span>
          </div>
        </div>

        {/* 5. EXPLORE SECTION: NASA Earth Observation Constellation Cards */}
        <section className="mt-16 w-full max-w-[980px]">
          <div className="text-center mb-8">
            <span className="inline-block rounded-full bg-emerald-950/80 px-3.5 py-1 text-[11px] font-mono font-bold tracking-wider text-emerald-300 border border-emerald-600/40 uppercase">
              🛰️ Open-Source NASA Earth Constellation
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Direct Spaceborne Feeds Driving Your Farm Shifts
            </h2>
            <p className="mt-2 text-[14px] text-zinc-300 max-w-[640px] mx-auto">
              Scroll down to watch the orange-and-blue particle swarm voyage into a full rotating spiral galaxy as NASA data connects to every field.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TELEMETRY.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-emerald-500/30 bg-[#071322]/85 p-5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-emerald-400/60 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300 uppercase font-bold">
                  <span>{item.label}</span>
                  <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] text-emerald-400 border border-emerald-700/50">
                    LIVE
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-white">{item.value}</span>
                  <span className="text-[12px] font-mono text-cyan-300">{item.unit}</span>
                </div>
                <p className="mt-2 text-[12px] text-zinc-300 leading-relaxed">{item.note}</p>
              </div>
            ))}
          </div>

          {/* Program Stats Bar */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PROGRAM_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-cyan-500/30 bg-[#06101e]/85 p-3.5 text-center backdrop-blur"
              >
                <span className="block text-2xl font-black text-emerald-300">{stat.value}</span>
                <span className="block text-[11px] font-mono text-zinc-400 uppercase mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 🌟 GEMMA 4 NEURAL CORE POINT-CLOUD BRAIN SECTION */}
        <section id="gemma4-brain-visualizer" className="mt-16 w-full max-w-[980px]">
          <div className="text-center mb-6">
            <span className="inline-block rounded-full bg-cyan-950/80 px-3.5 py-1 text-[11px] font-mono font-bold tracking-wider text-cyan-300 border border-cyan-600/40 uppercase">
              🧠 Gemma 4 Neural Core Architecture
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Point-Cloud Brain &amp; Living Constellation of Signal
            </h2>
            <p className="mt-2 text-[14px] text-zinc-300 max-w-[680px] mx-auto italic">
              "A luminous point-cloud brain hangs in the dark while the scan glides region by region — then lets go, scattering into a living constellation of signal."
            </p>
          </div>

          <PointCloudBrain className="w-full" />
        </section>

        {/* 6. FARMER CASE STUDIES & TESTIMONIALS */}
        <section className="mt-16 w-full max-w-[980px]">
          <div className="text-center mb-8">
            <span className="inline-block rounded-full bg-cyan-950/80 px-3.5 py-1 text-[11px] font-mono font-bold tracking-wider text-cyan-300 border border-cyan-600/40 uppercase">
              🌾 Global Impact
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Real Growers Adapting with NASA Earth Data
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VOICES.map((v) => (
              <div
                key={v.name}
                className="rounded-2xl border border-zinc-700/50 bg-[#06101e]/90 p-5 backdrop-blur-xl shadow-lg flex flex-col justify-between"
              >
                <p className="text-[13px] leading-relaxed text-zinc-200 italic">
                  "{v.quote}"
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="block text-[13px] font-bold text-white">{v.name}</span>
                    <span className="block text-[11px] text-emerald-400 font-mono">{v.role}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10.5px] font-mono text-cyan-300">{v.flight}</span>
                    <span className="block text-[10px] text-zinc-400">{v.place}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. FREQUENTLY ASKED QUESTIONS */}
        <section className="mt-16 mb-12 w-full max-w-[800px]">
          <div className="text-center mb-6">
            <span className="inline-block rounded-full bg-amber-950/80 px-3.5 py-1 text-[11px] font-mono font-bold tracking-wider text-amber-300 border border-amber-600/40 uppercase">
              ❓ Knowledge Base
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ.map((f: FaqItem) => (
              <div
                key={f.q}
                className="rounded-xl border border-zinc-800 bg-[#061120]/80 p-4.5 backdrop-blur text-left"
              >
                <h3 className="text-[14px] font-bold text-emerald-300">{f.q}</h3>
                <p className="mt-2 text-[12.5px] text-zinc-300 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="relative z-30 border-t border-emerald-500/25 bg-[#030914]/95 py-3 px-6 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            FIELD SHIFT · ADAPTING FARMS WITH NASA EARTH DATA · SPACE APPS CHALLENGE 2026
          </span>
          <span className="text-emerald-300 font-semibold hidden md:inline">
            ORION AGRI-SCOUT ENDERMAN · DRAG TO SHIFT SOIL BLOCKS · [T] WARP · DOUBLE CLICK TO TEST
          </span>
        </div>
      </footer>

      {/* 9. Living On-Screen Enderman AI (Autonomously assists with farm science, holds soil blocks, movable, ZERO self-damage) */}
      <ScreenEnderman />

      {/* 10. Aerodynamic Physics Dragon Flight Simulation */}
      <EnderDragonFlight />

      {/* 11. Modal: Full-Screen Gemma 4 Point-Cloud Brain Scan */}
      {brainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border border-cyan-400/50 bg-[#040c1a] shadow-[0_24px_100px_rgba(0,0,0,0.95),0_0_50px_rgba(6,182,212,0.35)] p-4 sm:p-6">
            <PointCloudBrain isOpen={true} onClose={() => setBrainModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
