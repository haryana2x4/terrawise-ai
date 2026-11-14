import { useEffect, useMemo, useState } from "react";
import CountUp from "@/components/CountUp";
import LoginPortal from "@/components/LoginPortal";
import OrbitalScene from "@/components/OrbitalScene";
import Starfield from "@/components/Starfield";
import { MANIFEST, PROGRAM_STATS, nextWindow } from "@/data/site";

function useCountdown(target: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, target - now);
  return {
    d: String(Math.floor(ms / 86_400_000)).padStart(3, "0"),
    h: String(Math.floor(ms / 3_600_000) % 24).padStart(2, "0"),
    m: String(Math.floor(ms / 60_000) % 60).padStart(2, "0"),
    s: String(Math.floor(ms / 1000) % 60).padStart(2, "0"),
    passed: ms === 0,
  };
}

export default function Hero() {
  const flight = useMemo(() => nextWindow(Date.now()), []);
  const t = useCountdown(Date.parse(flight.window));

  const ticker = useMemo(
    () =>
      MANIFEST.map((f) =>
        `${f.code} · ${f.mission} · ${new Date(f.window).toUTCString().slice(5, 17)} UTC · ${
          f.seatsLeft > 0 ? `${f.seatsLeft} seats` : "waitlist"
        }`,
      ),
    [],
  );

  return (
    <section id="top" className="grain relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-30">
        <img
          src="/images/earth-night-lights.jpg"
          alt="City lights on Earth's night side photographed from the International Space Station"
          className="kenburns h-full w-full object-cover object-center"
          fetchPriority="high"
        />
      </div>
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(130%_100%_at_78%_8%,#05080f00_0%,#05080fcc_55%,#05080ff7_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-20 h-44 bg-gradient-to-b from-[#05080fe6] to-transparent" />
      <div className="absolute inset-0 -z-20 opacity-70">
        <Starfield />
      </div>

      <div className="pointer-events-none absolute top-1/2 right-[-14%] -z-10 h-[min(1080px,124vw)] w-[min(1080px,124vw)] -translate-y-1/2 opacity-80 sm:right-[-6%] lg:right-[4%] lg:opacity-100">
        <OrbitalScene />
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(100deg,#05080ff2_0%,#05080fc4_30%,#05080f4d_58%,transparent_78%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hud-scanlines opacity-60" />
      <div className="pointer-events-none absolute inset-0 -z-10 hud-grid opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_40%,#000_0%,transparent_100%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#f0b64a22_0%,transparent_65%)] nebula" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#05080f]" />

      <div className="mx-auto max-w-[1240px] px-5 pt-28 pb-16 sm:px-8 sm:pt-36 lg:pt-40">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_minmax(400px,480px)] lg:gap-14">
          <div className="rise">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="eyebrow flex items-center gap-2">
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-go" />
                2027 candidate class · applications open
              </span>
              <span className="readout hidden text-[11px] text-muted-foreground sm:inline">
                {flight.code} · {flight.destination}
              </span>
            </div>

            <h1 className="mt-6 text-[clamp(2.6rem,7.2vw,4.9rem)] leading-[0.94] font-semibold tracking-[-0.03em] text-balance">
              Join the
              <span className="block bg-gradient-to-r from-[#ffd98a] via-[#e8edf6] to-[#a99cff] bg-clip-text text-transparent">
                Exploration.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-[#c3ccdd] sm:text-[17px]">
              Eleven flights flown, sixty-four civilians put in orbit, zero mishaps. Your seat is
              held for 72 hours while Flight Medicine reads your file — no deposit until you are
              cleared.
            </p>

            <div className="mt-8 panel rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                    Next launch window
                  </div>
                  <div className="mt-1 text-[15px] font-medium">
                    {flight.mission}{" "}
                    <span className="readout text-muted-foreground">
                      · {flight.vehicle}
                    </span>
                  </div>
                </div>
                <div className="readout text-[11px] text-muted-foreground">
                  {new Date(flight.window).toUTCString().replace("GMT", "UTC")}
                </div>
              </div>

              <div className="mt-4 flex items-end gap-2 sm:gap-4">
                {[
                  ["days", t.d],
                  ["hrs", t.h],
                  ["min", t.m],
                  ["sec", t.s],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-end gap-1.5">
                    <span className="readout text-[34px] leading-none font-medium tabular-nums text-[#f2f5fb] sm:text-[44px]">
                      {value}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      {label}
                    </span>
                  </div>
                ))}
                <span className="readout ml-auto hidden shrink-0 items-center gap-2 rounded-lg border border-[var(--hairline)] px-3 py-2 text-[11px] text-signal sm:flex">
                  T−
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--hairline)] pt-3 text-[11.5px] text-muted-foreground">
                <span>
                  Pad <span className="text-foreground">{flight.pad}</span>
                </span>
                <span>
                  Seats left{" "}
                  <span className={flight.seatsLeft > 0 ? "text-go" : "text-signal"}>
                    {flight.seatsLeft > 0 ? `${flight.seatsLeft} of ${flight.crewSize}` : "waitlist"}
                  </span>
                </span>
                <span>
                  Duration <span className="text-foreground">{flight.duration}</span>
                </span>
              </div>
            </div>

            <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {PROGRAM_STATS.map((s) => (
                <div key={s.label}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <CountUp
                      value={s.value}
                      className="block text-[26px] leading-none font-medium text-foreground"
                    />
                    <span className="mt-1.5 block text-[11.5px] tracking-wide text-muted-foreground">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#orion"
                className="btn-primary sheen inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[12.5px] font-semibold tracking-[0.16em] uppercase"
              >
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-[#05080f]" />
                Ask ORION AI
              </a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("orion:teleport", { detail: { target: "hero" } }))}
                className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-600/60 bg-fuchsia-950/30 px-5 py-3 text-[12.5px] font-mono font-semibold tracking-[0.14em] text-fuchsia-200 uppercase transition-all hover:bg-fuchsia-900/50 hover:text-white shadow-[0_0_15px_rgba(217,70,239,0.3)]"
              >
                ⚡ Teleport Avatar Here
              </button>
              <a
                href="#manifest"
                className="rounded-xl border border-[var(--hairline)] px-5 py-3 text-[12.5px] tracking-[0.16em] text-[#c3ccdd] uppercase transition-colors hover:border-primary/50 hover:text-foreground"
              >
                View manifest
              </a>
            </div>
          </div>

          <div id="apply" className="relative scroll-mt-28 lg:sticky lg:top-28">
            <LoginPortal />
          </div>
        </div>
      </div>

      <div className="relative border-y border-[var(--hairline)] bg-[#080d17a8] py-2.5 backdrop-blur">
        <div className="flex overflow-hidden">
          <div className="ticker-track flex shrink-0 gap-10 pr-10">
            {[...ticker, ...ticker].map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="readout flex shrink-0 items-center gap-2 text-[11px] tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase"
              >
                <span className="h-1 w-1 rounded-full bg-primary/70" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
