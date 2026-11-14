import { MANIFEST, STATUS_LABEL } from "@/data/site";

const TONE: Record<string, string> = {
  final_call: "text-signal border-signal/35 bg-signal/8",
  open: "text-go border-go/30 bg-go/8",
  waitlist: "text-muted-foreground border-[var(--hairline)]",
  classified: "text-[#9fb0c9] border-[#93a3c433] bg-[#93a3c40a]",
};

export default function Manifest() {
  const rows = MANIFEST.map((f) => {
    const filled = f.crewSize - f.seatsLeft;
    return { ...f, pct: Math.round((filled / f.crewSize) * 100) };
  });

  return (
    <section id="manifest" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="eyebrow">Public flight manifest</h2>
            <p className="mt-3 max-w-2xl text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              Six windows are open. Two are in final call.
            </p>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Manifest updates on the first Tuesday of each month after the range-control board
              confirms slots. Deposits are quoted per seat and invoiced only after medical
              clearance.
            </p>
          </div>
          <a
            href="#apply"
            className="rounded-lg border border-[var(--hairline)] px-4 py-2.5 text-[12.5px] font-medium transition-colors hover:border-primary/50 hover:bg-[#141d2c]"
          >
            Hold a seat from this list
          </a>
        </div>

        <div className="mt-10 overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <caption className="sr-only">
              Beyond Earth flight manifest with windows, vehicles, pads, seat availability and
              deposits
            </caption>
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                {["Flight", "Mission", "Vehicle & pad", "Window (UTC)", "Seats", "Deposit", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="py-3 pr-4 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.code}
                  className="group border-b border-[var(--hairline)] transition-colors hover:bg-[#0c1220]"
                >
                  <td className="readout py-4 pr-4 align-top text-[13px] text-primary">{f.code}</td>
                  <td className="py-4 pr-4 align-top">
                    <span className="block text-[14px] font-medium">{f.mission}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {f.destination}
                    </span>
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <span className="block text-[13px]">{f.vehicle}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">{f.pad}</span>
                  </td>
                  <td className="readout py-4 pr-4 align-top text-[12.5px]">
                    {new Date(f.window).toUTCString().slice(5, 22)}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{f.duration}</span>
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <div className="readout text-[12.5px]">
                      {f.seatsLeft > 0 ? `${f.seatsLeft} left` : "sold out"}
                      <span className="text-muted-foreground"> / {f.crewSize}</span>
                    </div>
                    <div className="mt-2 h-[3px] w-24 overflow-hidden rounded-full bg-[#93a3c41f]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ffd98a] to-[#dfa233]"
                        style={{ width: `${f.pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="readout py-4 pr-4 align-top text-[13px]">{f.deposit}</td>
                  <td className="py-4 align-top">
                    <span
                      className={`inline-block rounded-md border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase ${TONE[f.status]}`}
                    >
                      {STATUS_LABEL[f.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-[11.5px] text-[#7b8aa8]">
          Windows are provisional until the range issues a launch license for the specific date.
          A slip of more than 21 days moves a crew to the next available slot at no cost.
        </p>
      </div>
    </section>
  );
}
