import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; r: number; tw: number };

export default function Starfield({ density = 0.00008 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Star[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round(width * height * density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random(),
        r: Math.random() * 1.25 + 0.25,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const alpha = reduce ? 0.35 + s.z * 0.45 : 0.28 + Math.abs(Math.sin(t / 2400 + s.tw)) * (0.25 + s.z * 0.5);
        ctx.beginPath();
        ctx.fillStyle = s.z > 0.82 ? `rgba(180,214,255,${alpha})` : `rgba(226,236,255,${alpha})`;
        ctx.arc(s.x, s.y, s.r * (0.6 + s.z), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      paint(t);
      frame = requestAnimationFrame(loop);
    };

    build();
    if (reduce) paint(0);
    else frame = requestAnimationFrame(loop);

    const onResize = () => {
      cancelAnimationFrame(frame);
      build();
      if (reduce) paint(0);
      else frame = requestAnimationFrame(loop);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
