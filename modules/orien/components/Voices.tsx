import { VOICES } from "@/data/site";

export default function Voices() {
  return (
    <section
      id="voices"
      className="relative scroll-mt-24 overflow-hidden border-y border-[var(--hairline)] bg-[#070b14]"
    >
      <div className="absolute inset-0 -z-10 opacity-[0.16]">
        <img
          src="/images/sls-rollout.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-[center_30%]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_0%,#070b1455_0%,#070b14ee_70%)]" />

      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 className="eyebrow">Returned crews</h2>
            <p className="mt-3 text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              What sixty-four people told us afterwards.
            </p>
          </div>
          <p className="readout text-[11px] text-muted-foreground">
            quotes collected 30 days post-splashdown
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {VOICES.map((v) => (
            <blockquote key={v.name} className="panel rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <img
                  src={v.avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#93a3c433]"
                />
                <div className="min-w-0">
                  <footer className="text-[14px] font-medium">{v.name}</footer>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {v.role} · {v.place}
                  </p>
                </div>
                <span className="readout ml-auto shrink-0 rounded-md border border-[var(--hairline)] px-2 py-1 text-[10px] text-primary/80">
                  {v.flight}
                </span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-[#c9d1e0]">“{v.quote}”</p>
            </blockquote>
          ))}
        </div>

        <p className="mt-6 text-[11.5px] text-[#7b8aa8]">
          Candidate accounts are illustrative composites. Portraits are generated studio images and
          do not depict real individuals; all orbital photography on this page is genuine NASA
          imagery.
        </p>
      </div>
    </section>
  );
}
