import { useState } from "react";
import { BRAND, FAQ, type FaqItem } from "@/data/site";

export default function Consent() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="consent" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-16">
          <div>
            <h2 className="eyebrow">Before you apply</h2>
            <p className="mt-3 text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              The questions candidates actually ask.
            </p>

            <div className="mt-8 border-t border-[var(--hairline)]">
              {FAQ.map((item: FaqItem, i: number) => {
                const isOpen = open === i;
                return (
                  <div key={item.q} className="border-b border-[var(--hairline)]">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        className="flex w-full items-start justify-between gap-6 py-4 text-left"
                      >
                        <span
                          className={`text-[15px] font-medium transition-colors ${
                            isOpen ? "text-primary" : "hover:text-[#e8edf6]"
                          }`}
                        >
                          {item.q}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`readout mt-0.5 shrink-0 text-[16px] transition-transform duration-300 ${
                            isOpen ? "rotate-45 text-primary" : "text-muted-foreground"
                          }`}
                        >
                          +
                        </span>
                      </button>
                    </h3>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-2xl pb-5 text-[13.5px] leading-relaxed text-muted-foreground">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="lg:pt-4">
            <div className="panel sticky top-28 rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-signal" />
                <h2 className="font-mono text-[10px] tracking-[0.2em] text-signal uppercase">
                  Informed consent · 49 USC §1471
                </h2>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[#c9d1e0]">
                Spaceflight is not a regulated common-carrier activity. Before your altitude block
                you sign a disclosure acknowledging that launch vehicles can kill you, that no
                certification standard equivalent to commercial aviation applies to a spaceflight
                participant, and that you are flying as a participant rather than a passenger.
              </p>
              <ul className="mt-5 space-y-2.5 border-t border-[var(--hairline)] pt-5 text-[12.5px] text-muted-foreground">
                {[
                  `${BRAND.license}, in application`,
                  "AS9100D-certified manufacturing and ops",
                  "Independent Flight Rules Board, chaired by a retired USAF colonel",
                  "$25M operator liability tower · $5M per-seat accident policy",
                  "Medical data held under EU GDPR and HIPAA, never sold",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#apply"
                className="btn-primary mt-6 block rounded-xl px-4 py-3 text-center text-[12px] tracking-[0.14em] uppercase"
              >
                Start the application
              </a>
              <p className="mt-3 text-center text-[11px] text-[#7b8aa8]">
                Takes about 4 minutes · no card required
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
