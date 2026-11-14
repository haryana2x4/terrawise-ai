import { useEffect, useState, useCallback, useRef } from "react";
import EndermanAvatar, { type EndermanGesture } from "@/components/EndermanAvatar";
import { sound } from "@/lib/sound-effects";
import { orionVoice } from "@/lib/orion-voice";

export type TeleportTarget = "chat" | "hero" | "companion";

export default function TeleportAttraction() {
  const [activeLocation, setActiveLocation] = useState<TeleportTarget>("chat");
  const [isWarping, setIsWarping] = useState(false);
  const [warpFlash, setWarpFlash] = useState(false);
  const [companionExpanded, setCompanionExpanded] = useState(false);
  const [companionGesture, setCompanionGesture] = useState<EndermanGesture>("idle");
  const [tourRunning, setTourRunning] = useState(false);

  // Portal Particle Swarm State
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }>
  >([]);

  const animRef = useRef<number>(0);

  const triggerTeleport = useCallback(
    (target: TeleportTarget) => {
      if (isWarping) return;
      setIsWarping(true);
      setWarpFlash(true);
      sound.playTeleport();

      // Spawn 50 high-velocity portal cubes
      const count = 50;
      const initialParticles = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: window.innerWidth * (0.3 + Math.random() * 0.4),
        y: window.innerHeight * (0.3 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 24,
        vy: (Math.random() - 0.5) * 24,
        size: Math.random() * 12 + 6,
        color: ["#d946ef", "#c026d3", "#a855f7", "#e879f9", "#ffffff"][Math.floor(Math.random() * 5)],
        life: 1.0,
      }));
      setParticles(initialParticles);

      setTimeout(() => {
        setWarpFlash(false);
      }, 350);

      setTimeout(() => {
        setActiveLocation(target);
        setIsWarping(false);
        setParticles([]);

        // Scroll to destination if relevant
        if (target === "chat") {
          const el = document.getElementById("orion");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (target === "hero") {
          const el = document.getElementById("top");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 650);
    },
    [isWarping],
  );

  // Particle Physics Animation Loop
  useEffect(() => {
    if (particles.length === 0) return;

    const tick = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.95,
            vy: p.vy * 0.95 - 0.3, // slight upward anti-gravity drift
            life: p.life - 0.035,
          }))
          .filter((p) => p.life > 0),
      );
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [particles.length]);

  // Listen for window-level teleport broadcasts
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ target?: TeleportTarget }>;
      const target = customEvent.detail?.target || "hero";
      triggerTeleport(target);
    };

    window.addEventListener("orion:teleport", handler);
    return () => window.removeEventListener("orion:teleport", handler);
  }, [triggerTeleport]);

  // Auto Showcase / Attraction Tour
  const startTour = () => {
    if (tourRunning) return;
    setTourRunning(true);
    triggerTeleport("hero");

    setTimeout(() => {
      triggerTeleport("companion");
    }, 4500);

    setTimeout(() => {
      triggerTeleport("chat");
      setTourRunning(false);
    }, 9000);
  };

  return (
    <>
      {/* 1. Portal Warp Shockwave & Flash */}
      {warpFlash ? (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-r from-fuchsia-600/35 via-purple-600/40 to-fuchsia-600/35 backdrop-blur-[3px] transition-all duration-300">
          <div className="relative flex flex-col items-center">
            <div className="h-32 w-32 rounded-full border-4 border-fuchsia-400 animate-ping opacity-80" />
            <span className="mt-4 rounded-full border border-fuchsia-400 bg-black/80 px-5 py-2 font-mono text-[14px] font-bold tracking-[0.3em] text-fuchsia-200 uppercase shadow-[0_0_24px_rgba(217,70,239,0.8)]">
              ⚡ ENDER DISPERSION ACTIVE
            </span>
          </div>
        </div>
      ) : null}

      {/* 2. Floating Swarm of Minecraft Portal Cubes */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-[99] border border-fuchsia-300/40"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: `rotate(${p.id * 35}deg)`,
          }}
        />
      ))}

      {/* 3. Floating Orbital Teleport Control Dock */}
      <div className="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-2 rounded-2xl border border-[#3b1d54] bg-[#090614]/90 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <span className="flex items-center gap-1.5 pl-2 pr-1 font-mono text-[11px] font-semibold tracking-wider text-fuchsia-300 uppercase">
          <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-ping" />
          ORION WARP:
        </span>

        <button
          type="button"
          onClick={() => triggerTeleport("hero")}
          className={`rounded-xl px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all ${
            activeLocation === "hero"
              ? "bg-fuchsia-600 text-white font-bold shadow-[0_0_12px_rgba(217,70,239,0.6)]"
              : "text-zinc-300 hover:bg-[#1f1133] hover:text-fuchsia-200"
          }`}
          title="Teleport Enderman to Hero Bridge"
        >
          🚀 Hero Deck
        </button>

        <button
          type="button"
          onClick={() => triggerTeleport("companion")}
          className={`rounded-xl px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all ${
            activeLocation === "companion"
              ? "bg-fuchsia-600 text-white font-bold shadow-[0_0_12px_rgba(217,70,239,0.6)]"
              : "text-zinc-300 hover:bg-[#1f1133] hover:text-fuchsia-200"
          }`}
          title="Teleport Enderman to Floating Companion Pod"
        >
          🛸 Companion
        </button>

        <button
          type="button"
          onClick={() => triggerTeleport("chat")}
          className={`rounded-xl px-3 py-1.5 text-[11px] font-mono tracking-wider transition-all ${
            activeLocation === "chat"
              ? "bg-fuchsia-600 text-white font-bold shadow-[0_0_12px_rgba(217,70,239,0.6)]"
              : "text-zinc-300 hover:bg-[#1f1133] hover:text-fuchsia-200"
          }`}
          title="Teleport Enderman to Mission Chat Console"
        >
          💬 Chat Deck
        </button>

        <button
          type="button"
          onClick={startTour}
          disabled={tourRunning}
          className="ml-1 rounded-xl border border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-950/60 to-purple-950/60 px-3 py-1.5 text-[11px] font-mono font-bold tracking-wider text-fuchsia-200 hover:from-fuchsia-900 hover:to-purple-900 transition-all shadow-[0_0_10px_rgba(217,70,239,0.3)] disabled:opacity-50"
        >
          {tourRunning ? "✨ Touring…" : "✨ Demo Tour"}
        </button>
      </div>

      {/* 4. Teleport Location A: Hero Bridge Materialization Pod */}
      {activeLocation === "hero" ? (
        <div className="fixed top-24 right-6 z-40 w-[240px] rounded-2xl border-2 border-fuchsia-500/60 bg-[#07050f]/95 p-3 shadow-[0_12px_40px_rgba(217,70,239,0.35)] backdrop-blur-xl animate-in fade-in slide-in-from-top-6 duration-500">
          <div className="flex items-center justify-between pb-2 border-b border-[#2b1c3d]">
            <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-fuchsia-300 uppercase">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              ORION · HERO BRIDGE
            </span>
            <button
              type="button"
              onClick={() => triggerTeleport("chat")}
              className="rounded p-1 text-[10px] font-mono text-zinc-400 hover:text-white"
              title="Warp back to chat"
            >
              ✕ DOCK
            </button>
          </div>

          <div className="relative mt-2 h-[200px] w-full overflow-hidden rounded-xl border border-[#3b1d54] bg-[radial-gradient(circle_at_50%_38%,rgba(217,70,239,0.25),rgba(7,4,14,0.98)_68%)]">
            <EndermanAvatar
              mood="idle"
              gesture={companionGesture}
              onGestureChange={setCompanionGesture}
              interactive={true}
              showControls={false}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                setCompanionGesture("wave");
                sound.playGesture();
              }}
              className="flex-1 rounded-lg border border-[#351a4e] bg-[#140b22] py-1 text-[10.5px] font-mono text-zinc-300 hover:bg-fuchsia-950 hover:text-white"
            >
              ✋ Wave
            </button>
            <button
              type="button"
              onClick={() => {
                setCompanionGesture("stare");
                sound.playEnderStare();
              }}
              className="flex-1 rounded-lg border border-[#351a4e] bg-[#140b22] py-1 text-[10.5px] font-mono text-zinc-300 hover:bg-rose-950 hover:text-rose-200"
            >
              👁️ Stare
            </button>
            <button
              type="button"
              onClick={() => triggerTeleport("chat")}
              className="flex-1 rounded-lg bg-fuchsia-600 py-1 text-[10.5px] font-mono text-white font-semibold hover:bg-fuchsia-500"
            >
              💬 Ask
            </button>
          </div>
        </div>
      ) : null}

      {/* 5. Teleport Location B: Floating Interactive Orbital Companion */}
      {activeLocation === "companion" ? (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {companionExpanded ? (
            <div className="mb-3 w-[270px] rounded-2xl border-2 border-fuchsia-500/80 bg-[#080512]/95 p-4 shadow-[0_12px_48px_rgba(217,70,239,0.4)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between border-b border-[#3b1d54] pb-2">
                <span className="font-mono text-[11.5px] font-bold text-fuchsia-300 uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  ORION COMPANION POD
                </span>
                <button
                  type="button"
                  onClick={() => setCompanionExpanded(false)}
                  className="rounded px-1.5 py-0.5 text-[11px] font-mono text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="relative mt-2 h-[210px] w-full overflow-hidden rounded-xl border border-[#3b1d54] bg-[radial-gradient(circle_at_50%_38%,rgba(217,70,239,0.25),rgba(7,4,14,0.98)_68%)]">
                <EndermanAvatar
                  mood="idle"
                  gesture={companionGesture}
                  onGestureChange={setCompanionGesture}
                  interactive={true}
                  showControls={true}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerTeleport("chat")}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 py-2 text-center text-[12px] font-mono font-bold tracking-wider text-white uppercase shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:brightness-110"
                >
                  Open Full Console
                </button>
              </div>
            </div>
          ) : null}

          {/* Floating Companion Minimized Capsule Button */}
          <button
            type="button"
            onClick={() => setCompanionExpanded((v) => !v)}
            className="group flex items-center gap-2.5 rounded-full border-2 border-fuchsia-500/80 bg-[#090614] p-1.5 pr-4 shadow-[0_8px_30px_rgba(217,70,239,0.45)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95"
            title="Interact with ORION Companion"
          >
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-fuchsia-400 bg-black">
              <EndermanAvatar
                mood="idle"
                gesture="idle"
                interactive={false}
                showControls={false}
              />
            </div>
            <div className="text-left font-mono">
              <span className="block text-[11.5px] font-bold text-fuchsia-200 uppercase group-hover:text-white">
                ORION
              </span>
              <span className="block text-[9.5px] text-emerald-400">
                ACTIVE COMPANION
              </span>
            </div>
          </button>
        </div>
      ) : null}
    </>
  );
}
