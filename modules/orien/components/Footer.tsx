import { Wordmark } from "@/components/Nav";
import { BRAND, nextWindow } from "@/data/site";

const COLUMNS = [
  {
    title: "Program",
    links: ["Flight manifest", "Training syllabus", "Seat classes", "Research seats"],
  },
  {
    title: "Company",
    links: ["Flight safety record", "Careers", "Press kit", "Sustainability statement"],
  },
  {
    title: "Legal",
    links: ["Informed consent packet", "Privacy policy", "Terms of carriage", "Medical standards"],
  },
];

export default function Footer() {
  const flight = nextWindow(Date.now());

  return (
    <footer className="grain relative overflow-hidden border-t border-[var(--hairline)] bg-[#070b14]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f0b64a55] to-transparent" />

      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              {BRAND.legal} — crewed orbital and cislunar transport. {BRAND.hq}.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px]">
              <a href="#apply" className="text-primary underline-offset-4 hover:underline">
                Apply for a seat
              </a>
              <a href="mailto:flight-ops@beyond.earth" className="text-muted-foreground hover:text-foreground">
                flight-ops@beyond.earth
              </a>
              <span className="readout text-[#7b8aa8]">+1 321 555 0142</span>
            </div>
          </div>

          <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
                  {col.title}
                </h2>
                <ul className="mt-3.5 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#consent"
                        className="text-[13px] text-[#b6c1d6] transition-colors hover:text-foreground"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="rule mt-12" />

        <div className="mt-5 flex flex-col gap-4 text-[11.5px] text-[#7b8aa8] sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-2xl leading-relaxed">
            Orbital and deep-space photography on this site is provided by NASA, ESA, CSA and
            STScI and is used under public-domain or agency-credit terms. {BRAND.name} is a
            concept brand and is not affiliated with, endorsed by, or operated by any space agency.
            Manifest dates, licence numbers and crew accounts are illustrative.
          </p>
          <p className="readout shrink-0">
            Next window · {flight.code} ·{" "}
            {new Date(flight.window).toUTCString().slice(5, 17)}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--hairline)] pt-5 text-[11px]">
          <span>© {new Date().getFullYear()} {BRAND.legal}. All rights reserved.</span>
          <span className="flex items-center gap-2">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-go" />
            Range status: GO for BE-124 · weather 82% favorable
          </span>
        </div>
      </div>
    </footer>
  );
}
