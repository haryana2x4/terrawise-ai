import { PHASES } from "@/data/site";

export default function Training() {
  return (
    <section
      id="training"
      className="relative scroll-mt-24 border-y border-[var(--hairline)] bg-[#070b14]"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="eyebrow">Twelve weeks before you fly</h2>
            <p className="mt-3 text-[clamp(1.6rem,3.2vw,2.2rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              You are trained like crew, not like a tourist.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
              Every seat runs the same program. Roughly 74 hours of it is classroom and simulator;
              the rest happens in a centrifuge, a pressure chamber, a 10-metre tank and, at the end,
              a capsule that is fuelled.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--hairline)] pt-5">
              {[
                ["Facilities", "Toulouse · Kennedy · Vandenberg"],
                ["Attrition", "94% clearance rate"],
                ["Fitness", "No pilot licence required"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    {k}
                  </div>
                  <div className="mt-1 text-[13px]">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <ol className="relative space-y-3">
            <div
              aria-hidden="true"
              className="absolute top-4 bottom-4 left-[19px] w-px bg-gradient-to-b from-[#f0b64a55] via-[#f0b64a44] to-transparent"
            />
            {PHASES.map((p) => (
              <li
                key={p.step}
                className="panel relative rounded-2xl py-5 pr-5 pl-14 transition-colors hover:border-[#93a3c43d]"
              >
                <span className="readout absolute top-5 left-4 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hairline)] bg-[#0c1220] text-[12px] text-primary">
                  {p.step}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-[17px] font-semibold tracking-tight">{p.title}</h3>
                  <span className="readout rounded-md border border-[var(--hairline)] px-2 py-0.5 text-[10.5px] text-muted-foreground">
                    {p.weeks}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {p.detail.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-[12px] text-[#b6c1d6]">
                      <span aria-hidden="true" className="block h-1 w-1 rounded-full bg-primary/70" />
                      {d}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
