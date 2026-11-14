import { FRAMES, type Frame } from "@/data/site";

export default function Gallery() {
  return (
    <section id="flights" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="eyebrow">Where you are going</h2>
            <p className="mt-3 max-w-2xl text-[clamp(1.7rem,3.4vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em] text-balance">
              Every frame here is a real photograph. None of it is rendered.
            </p>
          </div>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
            Imagery courtesy of NASA, ESA, CSA and STScI. Public domain unless credited otherwise;
            original captions and mission numbers are listed under each frame.
          </p>
        </div>

        <div className="mt-10 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {FRAMES.map((f: Frame, i: number) => (
            <figure
              key={f.src}
              className={`group relative overflow-hidden rounded-2xl border border-[var(--hairline)] ${f.span} ${
                i === 0 ? "sm:col-span-2 lg:col-span-7" : ""
              }`}
            >
              <div className="aspect-[16/10] w-full overflow-hidden lg:aspect-auto lg:h-full lg:min-h-[240px]">
                <img
                  src={f.src}
                  alt={f.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#05080ff2] via-[#05080f55] to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <h3 className="text-[15px] font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[#c3ccdd]">
                  {f.caption}
                </p>
                <span className="readout mt-2.5 block text-[10px] tracking-[0.12em] text-primary/70 uppercase">
                  {f.credit}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
