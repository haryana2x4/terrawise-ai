import React, { useEffect, useRef } from "react";
import { SunPhase } from "../utils/sunEngine";

interface AmbientWeatherCanvasProps {
  phase: SunPhase;
  hasRain: boolean;
  isLiteTier: boolean;
}

export const AmbientWeatherCanvas: React.FC<AmbientWeatherCanvasProps> = ({
  phase,
  hasRain,
  isLiteTier
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // If Lite Tier or user prefers reduced motion, do not run canvas animation loop
    if (isLiteTier) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle count: 25 particles maximum to guarantee 60fps on all GPUs
    const PARTICLE_COUNT = 24;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.5 + 1.0,
      vx: (Math.random() - 0.5) * 0.4,
      vy: phase === "night" ? (Math.random() - 0.5) * 0.3 : Math.random() * 0.3 + 0.1,
      alpha: Math.random() * 0.6 + 0.2,
      pulseSpeed: Math.random() * 0.03 + 0.015,
      hue: phase === "night" ? 140 : 45 // Yellow/gold motes or green fireflies
    }));

    // Rain streaks if raining
    const RAIN_COUNT = hasRain ? 40 : 0;
    const raindrops = Array.from({ length: RAIN_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 20 + 15,
      speed: Math.random() * 8 + 12
    }));

    let lastTime = performance.now();

    const render = (time: number) => {
      // Pause if tab is hidden
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Render rain streaks if present
      if (hasRain && raindrops.length > 0) {
        ctx.strokeStyle = "rgba(200, 230, 255, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const drop of raindrops) {
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 3, drop.y + drop.length);
          drop.y += drop.speed;
          drop.x -= 1.5;
          if (drop.y > height) {
            drop.y = -20;
            drop.x = Math.random() * width;
          }
        }
        ctx.stroke();
      }

      // Render dust motes / fireflies
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Sine pulse alpha
        const pulse = Math.sin(time * p.pulseSpeed) * 0.3 + 0.6;
        const currentAlpha = Math.max(0.1, Math.min(0.9, p.alpha * pulse));

        ctx.fillStyle = phase === "night"
          ? `rgba(180, 245, 120, ${currentAlpha})`
          : `rgba(255, 230, 160, ${currentAlpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [phase, hasRain, isLiteTier]);

  if (isLiteTier) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      aria-hidden="true"
    />
  );
};
