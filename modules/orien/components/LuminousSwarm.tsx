import { useEffect, useRef, useState } from "react";

interface LuminousSwarmProps {
  className?: string;
  externalProgress?: number;
}

interface Particle {
  id: number;
  arm: number;
  distFract: number;
  spiralRadius: number;
  spiralAngle: number;
  coreRadius: number;
  coreAngle: number;
  zOffset: number;
  size: number;
  orbitSpeed: number;
  colorType: "orange" | "blue" | "white";
  colorRgb: string;
  twinklePhase: number;
  twinkleSpeed: number;
}

export default function LuminousSwarm({ className = "", externalProgress }: LuminousSwarmProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internalProgress, setInternalProgress] = useState(0);

  // Sync external progress or scroll
  useEffect(() => {
    if (typeof externalProgress === "number") {
      setInternalProgress(Math.max(0, Math.min(1, externalProgress)));
    }
  }, [externalProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Generate Swarm of 1,350 Orange and Blue luminous cosmic particles
    const PARTICLE_COUNT = 1350;
    const particles: Particle[] = [];

    const orangeColors = [
      "255, 120, 20",
      "255, 165, 38",
      "255, 85, 0",
      "251, 146, 60",
      "245, 158, 11",
    ];

    const blueColors = [
      "0, 225, 255",
      "56, 189, 248",
      "0, 162, 255",
      "37, 99, 235",
      "125, 211, 252",
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const arm = i % 2; // Dual spiral arms
      const armOffset = arm * Math.PI;
      const distFract = Math.pow(i / PARTICLE_COUNT, 0.72); // Dense core, expansive arms
      const maxGalaxyRadius = Math.min(width, height) * 0.52;
      const spiralRadius = 15 + distFract * maxGalaxyRadius;
      const spiralAngle = spiralRadius * 0.0095 + armOffset + (Math.random() - 0.5) * 0.55;

      // Single point of light singularity coordinates (radius ~12px)
      const coreRadius = Math.pow(Math.random(), 2.8) * 16;
      const coreAngle = Math.random() * Math.PI * 2;
      const zOffset = (Math.random() - 0.5) * (40 + (1 - distFract) * 60);

      // Color selection: alternating arms with bright cosmic core
      let colorType: "orange" | "blue" | "white" = "white";
      let colorRgb = "255, 255, 255";

      if (distFract < 0.08) {
        colorType = "white";
        colorRgb = "255, 255, 255";
      } else if (arm === 0) {
        colorType = "orange";
        colorRgb = orangeColors[i % orangeColors.length];
      } else {
        colorType = "blue";
        colorRgb = blueColors[i % blueColors.length];
      }

      particles.push({
        id: i,
        arm,
        distFract,
        spiralRadius,
        spiralAngle,
        coreRadius,
        coreAngle,
        zOffset,
        size: Math.random() * 2.2 + 0.9,
        orbitSpeed: 0.003 + (1 - distFract) * 0.007,
        colorType,
        colorRgb,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.04 + 0.02,
      });
    }

    // Scroll progress smoothing & state
    let targetProgress = 0;
    let currentProgress = 0;
    let rotation = 0;
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let animFrame = 0;

    // Track scroll
    const updateScrollProgress = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const scrollY = window.scrollY || window.pageYOffset || 0;
      targetProgress = Math.min(1, Math.max(0, scrollY / (maxScroll * 0.85)));
      setInternalProgress(targetProgress);
    };

    const onScroll = () => {
      updateScrollProgress();
    };

    // Listen to custom voyage slider events
    const onVoyageEvent = (e: Event) => {
      const custom = e as CustomEvent<{ progress: number }>;
      if (typeof custom.detail?.progress === "number") {
        targetProgress = Math.max(0, Math.min(1, custom.detail.progress));
        setInternalProgress(targetProgress);
      }
    };

    // Mouse tilt for deep 3D perspective
    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / width - 0.5) * 2;
      const ny = (e.clientY / height - 0.5) * 2;
      targetTiltX = ny * 0.35; // tilt around X axis
      targetTiltY = nx * 0.45; // tilt around Y axis
    };

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      updateScrollProgress();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("voyage:progress", onVoyageEvent as EventListener);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("resize", onResize);

    updateScrollProgress();

    // 60 FPS Render Loop
    const render = () => {
      // Smooth interpolation for cinematic metamorphosis
      currentProgress += (targetProgress - currentProgress) * 0.065;
      rotation += 0.0022 + (1 - currentProgress) * 0.004;
      tiltX += (targetTiltX - tiltX) * 0.05;
      tiltY += (targetTiltY - tiltY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Set additive glowing composite
      ctx.globalCompositeOperation = "lighter";

      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // 1. Central Singularity / Galaxy Core Glow
      const coreAlpha = 0.35 + (1 - currentProgress) * 0.45;
      const coreGlowRadius = 25 + currentProgress * 95;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreGlowRadius,
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
      gradient.addColorStop(0.28, `rgba(255, 140, 30, ${coreAlpha * 0.7})`);
      gradient.addColorStop(0.65, `rgba(0, 200, 255, ${coreAlpha * 0.45})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(centerX, centerY, coreGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Render all 1,350 Orange & Blue particles endlessly reshaping
      const morph = currentProgress; // 0 = Single Point of Light, 1 = Vast Spiral Galaxy

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        p.twinklePhase += p.twinkleSpeed;

        // Current Radius: smoothly interpolates from core singularity to vast spiral arms
        const currentR = p.coreRadius * (1 - morph) + p.spiralRadius * morph;

        // Current Angle: spins faster at core, expands into arms
        const spin = rotation * (p.orbitSpeed * 180 + (1 - morph) * 4);
        const currentTheta = p.coreAngle * (1 - morph) + (p.spiralAngle + spin) * morph;

        // 3D coordinates in galaxy plane
        let x = Math.cos(currentTheta) * currentR;
        let y = Math.sin(currentTheta) * currentR * 0.62; // inclined perspective
        let z = p.zOffset * morph;

        // Apply 3D perspective rotation (tiltX & tiltY)
        const cosY = Math.cos(tiltY);
        const sinY = Math.sin(tiltY);
        const xRot = x * cosY - z * sinY;
        const zRot = x * sinY + z * cosY;

        const cosX = Math.cos(tiltX);
        const sinX = Math.sin(tiltX);
        const yRot = y * cosX - zRot * sinX;
        const finalZ = y * sinX + zRot * cosX;

        // Depth perspective projection
        const focalLength = 650;
        const scale = focalLength / (focalLength + finalZ + 250);
        const screenX = centerX + xRot * scale;
        const screenY = centerY + yRot * scale;

        // Calculate luminosity & opacity
        const twinkle = Math.sin(p.twinklePhase) * 0.25 + 0.75;
        const alpha = Math.min(1, Math.max(0.12, (0.4 + (1 - morph) * 0.5) * twinkle * scale));
        const radius = Math.max(0.7, p.size * scale * (1 + (1 - morph) * 0.4));

        // Draw particle
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.colorRgb}, ${alpha})`;
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Extra corona for bright stars
        if (p.size > 2.0 && Math.random() < 0.25) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${p.colorRgb}, ${alpha * 0.35})`;
          ctx.arc(screenX, screenY, radius * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("voyage:progress", onVoyageEvent as EventListener);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-0 h-full w-full select-none ${className}`}
    />
  );
}
