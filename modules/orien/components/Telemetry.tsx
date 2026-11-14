import { TELEMETRY } from "@/data/site";

export default function Telemetry() {
  return (
    <section aria-label="Mission profile" className="relative border-y border-[var(--hairline)] bg-[#070b14]">
      <div className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow">Flight profile · nominal ascent to 428 km</h2>
          <span className="readout flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-go" />
            values from BE-121 flight-data recorder
          </span>
        </div>

        <dl className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] sm:grid-cols-2 lg:grid-cols-3">
          {TELEMETRY.map((row) => (
            <div key={row.label} className="group bg-[#0a1018] px-5 py-5 transition-colors hover:bg-[#0c1220]">
              <dt className="text-[12px] tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="mt-2 flex items-baseline gap-2">
                <span className="readout text-[25px] leading-none font-medium text-[#f2f5fb] transition-colors group-hover:text-primary">
                  {row.value}
                </span>
                <span className="readout text-[11px] text-primary/70">{row.unit}</span>
              </dd>
              <dd className="mt-2 text-[11.5px] text-[#7b8aa8]">{row.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
