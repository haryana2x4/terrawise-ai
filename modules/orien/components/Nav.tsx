import { useEffect, useState } from "react";
import { sound } from "@/lib/sound-effects";

const LINKS = [
  { href: "#apply", label: "Portal" },
  { href: "#orion", label: "ORION AI" },
  { href: "#manifest", label: "Manifest" },
  { href: "#training", label: "Training" },
  { href: "#flights", label: "Imagery" },
  { href: "#voices", label: "Crews" },
  { href: "#consent", label: "Consent" },
];

export function Wordmark() {
  return (
    <a href="#top" className="group flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="be-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffd98a" />
            <stop offset="100%" stopColor="#dfa233" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="6.4" fill="none" stroke="url(#be-mark)" strokeWidth="2.1" />
        <ellipse
          cx="16"
          cy="16"
          rx="13.4"
          ry="4.8"
          fill="none"
          stroke="#93a3c4"
          strokeWidth="1.5"
          transform="rotate(-24 16 16)"
          opacity="0.85"
        />
        <circle cx="27.2" cy="10.6" r="1.5" fill="#f0b64a" />
      </svg>
      <span className="text-[13px] font-semibold tracking-[0.34em] uppercase transition-colors group-hover:text-primary">
        Beyond Earth
      </span>
    </a>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(() => sound.isMuted());

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleToggleSound = () => {
    const next = sound.toggleMute();
    setMuted(next);
  };

  const handleWarp = () => {
    window.dispatchEvent(new CustomEvent("orion:teleport", { detail: { target: "hero" } }));
  };

  const handleDragon = () => {
    window.dispatchEvent(new CustomEvent("orion:dragon"));
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--hairline)] bg-[#05080fd9] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Wordmark />

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground font-medium"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio Mute/Unmute */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-mono tracking-wider transition-all ${
              muted
                ? "border-red-900/60 bg-red-950/30 text-red-300"
                : "border-fuchsia-800/60 bg-fuchsia-950/30 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.2)]"
            }`}
            title={muted ? "Unmute Voice & FX" : "Mute Sound"}
          >
            {muted ? "🔇" : "🔊"}
            <span className="hidden md:inline">{muted ? "Muted" : "Audio"}</span>
          </button>

          {/* Ender Dragon Fly-by Trigger */}
          <button
            type="button"
            onClick={handleDragon}
            className="flex items-center gap-1.5 rounded-lg border border-purple-800/60 bg-purple-950/40 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-purple-200 hover:bg-purple-900/60 hover:text-white transition-all shadow-[0_0_12px_rgba(168,85,247,0.25)]"
            title="Summon Minecraft Ender Dragon Fly-By (Shortcut: Key 'D')"
          >
            🐉 <span className="hidden sm:inline">Dragon</span>
          </button>

          {/* Teleport Trigger */}
          <button
            type="button"
            onClick={handleWarp}
            className="flex items-center gap-1.5 rounded-lg border border-fuchsia-700/70 bg-fuchsia-950/40 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-fuchsia-200 hover:bg-fuchsia-900/60 hover:text-white transition-all shadow-[0_0_12px_rgba(217,70,239,0.3)]"
            title="Teleport ORION Enderman across screen"
          >
            ⚡ <span className="hidden sm:inline">Teleport</span>
          </button>

          <a
            href="#manifest"
            className="hidden readout text-[11px] tracking-[0.14em] text-muted-foreground uppercase xl:block"
          >
            142 seats · 2027
          </a>
          <a
            href="#apply"
            className="btn-primary rounded-lg px-3.5 py-2 text-[11.5px] font-semibold tracking-[0.12em] uppercase"
          >
            Sign in
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation"
            className="rounded-lg border border-[var(--hairline)] p-2 text-muted-foreground lg:hidden"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
              {open ? (
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[var(--hairline)] bg-[#080d17f2] px-5 py-3 backdrop-blur-xl lg:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block border-b border-[var(--hairline)] py-3 text-[14px] last:border-0"
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={handleToggleSound}
              className="flex-1 rounded-lg border border-[#3b1d54] py-2 text-[12px] font-mono"
            >
              {muted ? "🔇 Unmute Audio" : "🔊 Audio Online"}
            </button>
            <button
              type="button"
              onClick={handleWarp}
              className="flex-1 rounded-lg bg-fuchsia-600 py-2 text-[12px] font-mono text-white font-bold"
            >
              ⚡ Teleport
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
