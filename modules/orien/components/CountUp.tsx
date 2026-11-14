import { useEffect, useRef, useState } from "react";

export default function CountUp({
  value,
  duration = 1400,
  className = "",
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const target = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  const suffix = value.replace(/[\d\s,]/g, "");
  const [display, setDisplay] = useState(target > 0 ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!Number.isFinite(target) || target === 0) return;
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || started.current) return;
        started.current = true;
        observer.disconnect();
        const from = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - from) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    const fallback = window.setTimeout(() => setDisplay(target), 2500);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [target, duration]);

  return (
    <span ref={ref} className={`readout tabular-nums ${className}`}>
      {display}
      {suffix}
    </span>
  );
}
