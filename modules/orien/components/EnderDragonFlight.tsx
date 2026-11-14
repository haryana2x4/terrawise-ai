import { useEffect, useRef, useState, useCallback } from "react";
import { sound } from "@/lib/sound-effects";

interface SpineNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  type?: "breath" | "vapor" | "lightning" | "spark";
}

type FlightPath = "swoop" | "divebomb" | "barrel_roll";

export default function EnderDragonFlight() {
  const [active, setActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrame = useRef<number>(0);
  const flightPathRef = useRef<FlightPath>("swoop");

  const triggerFlight = useCallback(() => {
    if (active) return;

    // Randomly pick a flight path
    const paths: FlightPath[] = ["swoop", "divebomb", "barrel_roll"];
    flightPathRef.current = paths[Math.floor(Math.random() * paths.length)];

    setActive(true);
    sound.playDragonRoar();

    const canvas = canvasRef.current;
    if (!canvas) {
      setTimeout(() => setActive(false), 6000);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // --- REAL PHYSICS FLIGHT STATE ---
    let posX = -180;
    let posY = canvas.height * 0.28;
    let velX = 7.5;
    let velY = 1.2;
    let heading = 0;
    let pitch = 0;
    let roll = 0;
    let wingPhase = 0;
    let flightTime = 0;
    let overlayAlpha = 0;
    let lightningTimer = 0;
    let lightningFlash = 0;

    // 12-Segment Spine: Head (0) -> 4 Necks (1-4) -> Torso (5) -> 6 Tails (6-11)
    const spine: SpineNode[] = Array.from({ length: 12 }, () => ({
      x: posX, y: posY, vx: 0, vy: 0, angle: 0,
    }));

    const particles: Particle[] = [];
    const segmentDist = 18;
    const chosenPath = flightPathRef.current;

    const render = () => {
      flightTime += 0.016;

      // 1. SCREEN DARKENING OVERLAY (fade in, sustain, fade out)
      const progress = posX / (canvas.width + 400);
      if (progress < 0.15) {
        overlayAlpha = Math.min(0.45, overlayAlpha + 0.012);
      } else if (progress > 0.75) {
        overlayAlpha = Math.max(0, overlayAlpha - 0.018);
      }

      // 2. FLIGHT PATH VARIANTS
      let targetY: number;
      switch (chosenPath) {
        case "divebomb":
          // High entry, steep dive mid-screen, pull up at bottom
          if (flightTime < 1.2) {
            targetY = canvas.height * 0.12;
          } else if (flightTime < 2.2) {
            targetY = canvas.height * 0.75;
          } else {
            targetY = canvas.height * 0.25 + Math.sin(flightTime * 1.8) * 80;
          }
          break;
        case "barrel_roll":
          // Sinuous figure-8 with roll
          targetY = canvas.height * 0.35 + Math.sin(flightTime * 3.0) * 160;
          roll = Math.sin(flightTime * 3.0) * 1.2;
          break;
        default: // "swoop"
          targetY = canvas.height * 0.32 + Math.sin(flightTime * 2.2) * 140 - Math.cos(flightTime * 1.1) * 60;
          break;
      }

      const steerY = (targetY - posY) * 0.045;

      // Flapping cycle
      const flapRate = velY < 0 ? 14 : 9;
      wingPhase += 0.016 * flapRate;

      const flapSine = Math.sin(wingPhase);
      const isDownstroke = Math.cos(wingPhase) > 0;
      const liftForce = isDownstroke ? Math.max(0, flapSine) * 3.8 : -1.2;
      const thrustForce = isDownstroke ? Math.max(0, flapSine) * 1.5 : -0.2;

      velY += (steerY - liftForce * 0.4) * 0.12;
      velX += thrustForce * 0.04;

      velX = Math.max(5.5, Math.min(11, velX * 0.995));
      velY = Math.max(-8, Math.min(8, velY * 0.97));

      posX += velX;
      posY += velY;

      const targetHeading = Math.atan2(velY, velX);
      heading += (targetHeading - heading) * 0.15;
      pitch = targetHeading;

      if (chosenPath !== "barrel_roll") {
        const turnRate = targetHeading - heading;
        const targetRoll = Math.max(-0.7, Math.min(0.7, turnRate * 8.5 + (velY < 0 ? 0.15 : -0.15)));
        roll += (targetRoll - roll) * 0.12;
      }

      // 3. VERLET SPINE PHYSICS
      spine[0].x = posX;
      spine[0].y = posY;
      spine[0].angle = heading;

      for (let i = 1; i < spine.length; i++) {
        const leader = spine[i - 1];
        const current = spine[i];

        const dx = leader.x - current.x;
        const dy = leader.y - current.y;
        const angle = Math.atan2(dy, dx);

        // Tail segments have softer springs for more wobble
        const springK = i >= 6 ? 0.28 : 0.42;

        const tx = leader.x - Math.cos(angle) * segmentDist;
        const ty = leader.y - Math.sin(angle) * segmentDist;

        current.vx = (tx - current.x) * springK;
        current.vy = (ty - current.y) * springK;
        current.x += current.vx;
        current.y += current.vy;
        current.angle = angle;
      }

      // 4. DRAGON BREATH PARTICLES (mouth fire)
      if (Math.random() < 0.7) {
        const breathAngle = heading + (Math.random() - 0.5) * 0.6;
        particles.push({
          x: posX + Math.cos(heading) * 48,
          y: posY + Math.sin(heading) * 48,
          vx: Math.cos(breathAngle) * (3 + Math.random() * 3),
          vy: Math.sin(breathAngle) * (3 + Math.random() * 3) - 1.5,
          size: Math.random() * 12 + 6,
          color: ["#d946ef", "#c026d3", "#a855f7", "#f0abfc", "#ffffff"][Math.floor(Math.random() * 5)],
          alpha: 0.95,
          type: "breath",
        });
      }

      // 5. WINGTIP VAPOR TRAILS
      const torsoNode = spine[5];
      for (let side = -1; side <= 1; side += 2) {
        if (Math.random() < 0.45) {
          const wingTipX = torsoNode.x + Math.cos(torsoNode.angle + Math.PI / 2 * side) * 70;
          const wingTipY = torsoNode.y + Math.sin(torsoNode.angle + Math.PI / 2 * side) * 70;
          particles.push({
            x: wingTipX,
            y: wingTipY,
            vx: -velX * 0.15 + (Math.random() - 0.5),
            vy: (Math.random() - 0.5) * 1.5,
            size: Math.random() * 5 + 2,
            color: ["#a78bfa", "#c4b5fd", "#ffffff88"][Math.floor(Math.random() * 3)],
            alpha: 0.6,
            type: "vapor",
          });
        }
      }

      // 6. LIGHTNING STRIKES when dragon is mid-screen
      lightningTimer -= 0.016;
      if (posX > canvas.width * 0.2 && posX < canvas.width * 0.8 && lightningTimer <= 0 && Math.random() < 0.015) {
        lightningFlash = 1.0;
        lightningTimer = 1.5; // Cooldown

        // Spawn lightning bolt spark particles
        const boltX = posX + (Math.random() - 0.5) * 200;
        for (let s = 0; s < 12; s++) {
          particles.push({
            x: boltX,
            y: canvas.height * 0.05 + s * (canvas.height * 0.08),
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 6 + 3,
            color: "#e0e7ff",
            alpha: 1.0,
            type: "spark",
          });
        }
      }
      if (lightningFlash > 0) lightningFlash -= 0.06;

      // ---- RENDER ----
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Screen darkening overlay
      if (overlayAlpha > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(3, 0, 15, ${overlayAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Lightning flash overlay
      if (lightningFlash > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(200, 180, 255, ${lightningFlash * 0.35})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw forked lightning bolt
        ctx.save();
        ctx.strokeStyle = `rgba(220, 200, 255, ${lightningFlash})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = "#d8b4fe";
        ctx.shadowBlur = 20;
        let lx = posX + (Math.random() - 0.5) * 100;
        let ly = 0;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        while (ly < canvas.height) {
          lx += (Math.random() - 0.5) * 40;
          ly += 20 + Math.random() * 30;
          ctx.lineTo(lx, ly);
          // Fork
          if (Math.random() < 0.15) {
            const fx = lx + (Math.random() - 0.5) * 80;
            const fy = ly + 30 + Math.random() * 40;
            ctx.moveTo(lx, ly);
            ctx.lineTo(fx, fy);
            ctx.moveTo(lx, ly);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Render physics particles
      for (let p = particles.length - 1; p >= 0; p--) {
        const pt = particles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vx *= 0.94;
        pt.vy *= 0.94;
        pt.alpha -= pt.type === "breath" ? 0.02 : pt.type === "spark" ? 0.04 : 0.03;
        pt.size *= pt.type === "breath" ? 0.98 : 0.96;

        if (pt.alpha <= 0 || pt.size < 0.5) {
          particles.splice(p, 1);
          continue;
        }

        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.alpha;

        if (pt.type === "breath") {
          // Dragon breath has glow
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = pt.size * 2.5;
        }

        if (pt.type === "spark") {
          ctx.shadowColor = "#e0e7ff";
          ctx.shadowBlur = 12;
        }

        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.restore();
      }

      // 7. RENDER DRAGON BODY (Tail to Head)
      ctx.save();

      const bodyBob = Math.sin(wingPhase) * 4;

      // Draw 6 Tail Segments with FORKED TIP
      for (let t = spine.length - 1; t >= 6; t--) {
        const node = spine[t];
        const tailIdx = t - 6;
        const width = 16 - tailIdx * 1.8;
        const height = 12 - tailIdx * 1.2;

        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.angle);

        ctx.fillStyle = "#0c0c14";
        ctx.strokeStyle = "#2e1a47";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-width / 2, -height / 2, width, height);
        ctx.strokeRect(-width / 2, -height / 2, width, height);

        // Dorsal plate
        ctx.fillStyle = "#64748b";
        ctx.fillRect(-width / 4, -height / 2 - 5, width / 2, 5);

        // FORKED TAIL TIP on last 2 segments
        if (t >= 10) {
          ctx.fillStyle = "#1e1b4b";
          ctx.beginPath();
          ctx.moveTo(width / 2, -height / 2 - 3);
          ctx.lineTo(width / 2 + 10, -height / 2 - 10);
          ctx.lineTo(width / 2 + 3, -height / 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(width / 2, height / 2 + 3);
          ctx.lineTo(width / 2 + 10, height / 2 + 10);
          ctx.lineTo(width / 2 + 3, height / 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // TORSO with BODY GLOW
      const torso = spine[5];
      ctx.save();
      ctx.translate(torso.x, torso.y + bodyBob);
      ctx.rotate(torso.angle);
      ctx.transform(1, 0, Math.sin(roll) * 0.25, Math.cos(roll), 0, 0);

      // Body glow aura
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#10101a";
      ctx.strokeStyle = "#3b1e5a";
      ctx.lineWidth = 2;
      ctx.fillRect(-32, -20, 64, 40);
      ctx.strokeRect(-32, -20, 64, 40);
      ctx.shadowBlur = 0;

      // Dorsal plates
      ctx.fillStyle = "#64748b";
      ctx.fillRect(-22, -27, 12, 7);
      ctx.fillRect(-2, -27, 12, 7);
      ctx.fillRect(16, -27, 12, 7);

      // Talons
      ctx.fillStyle = "#090910";
      ctx.fillRect(-18, 18, 12, 16);
      ctx.fillRect(-14, 34, 18, 6);

      // BAT WINGS with TRANSLUCENT MEMBRANE
      const drawArticulatedWing = (side: number) => {
        ctx.save();
        ctx.translate(-8, side * 14);

        const baseFlap = Math.sin(wingPhase) * 0.75 * side;
        const bankOffset = roll * 0.6;
        const shoulderAngle = baseFlap + bankOffset;

        ctx.rotate(shoulderAngle);

        const bone1Length = 55;
        const elbowX = 20;
        const elbowY = side * bone1Length;

        const wristFlap = Math.sin(wingPhase - 0.4) * 0.45 * side;
        const wristAngle = shoulderAngle + wristFlap;
        const wristX = elbowX + Math.cos(wristAngle) * 50;
        const wristY = elbowY + Math.sin(wristAngle) * 50 * side;

        // TRANSLUCENT WING MEMBRANE
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(wristX, wristY);
        ctx.lineTo(wristX - 35, wristY * 0.85);
        ctx.lineTo(elbowX - 25, elbowY * 0.7);
        ctx.lineTo(-24, 0);
        ctx.closePath();

        // Semi-transparent dark purple membrane
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = "#0f0524";
        ctx.fill();
        ctx.restore();

        // Veins / inner glow lines
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = "#7c3aed";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo((elbowX + wristX) / 2, (elbowY + wristY) / 2);
        ctx.stroke();
        ctx.restore();

        // Bone spars
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(wristX, wristY);
        ctx.stroke();

        // Finger ribs
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(elbowX, elbowY);
        ctx.lineTo(wristX - 35, wristY * 0.85);
        ctx.moveTo(elbowX, elbowY);
        ctx.lineTo(elbowX - 25, elbowY * 0.7);
        ctx.stroke();

        ctx.restore();
      };

      drawArticulatedWing(-1);
      drawArticulatedWing(1);

      ctx.restore(); // torso transform

      // 4 Neck Segments
      for (let n = 4; n >= 1; n--) {
        const neckNode = spine[n];
        ctx.save();
        ctx.translate(neckNode.x, neckNode.y);
        ctx.rotate(neckNode.angle);

        ctx.fillStyle = "#12121e";
        ctx.strokeStyle = "#3b1e5a";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-10, -12, 20, 24);
        ctx.strokeRect(-10, -12, 20, 24);

        ctx.fillStyle = "#64748b";
        ctx.fillRect(-5, -16, 10, 4);

        ctx.restore();
      }

      // HEAD with enhanced glow
      const headNode = spine[0];
      ctx.save();
      ctx.translate(headNode.x, headNode.y);
      ctx.rotate(headNode.angle);

      // Skull
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#131320";
      ctx.strokeStyle = "#431e68";
      ctx.lineWidth = 2;
      ctx.fillRect(-14, -14, 28, 28);
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.shadowBlur = 0;

      // Snout
      ctx.fillRect(14, -6, 20, 18);
      ctx.strokeRect(14, -6, 20, 18);

      // Jaw (opens during roar)
      const jawDrop = Math.max(0, Math.sin(wingPhase * 0.8) * 6);
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(10, 12 + jawDrop, 22, 8);

      // Horns
      ctx.fillStyle = "#64748b";
      ctx.fillRect(-18, -22, 12, 8);
      ctx.fillRect(-26, -28, 10, 8);

      // Glowing Magenta Eyes with intense glow
      ctx.fillStyle = "#d946ef";
      ctx.shadowColor = "#f5d0fe";
      ctx.shadowBlur = 20;
      ctx.fillRect(8, -6, 8, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, -5, 3, 2);
      ctx.shadowBlur = 0;

      ctx.restore();

      ctx.restore(); // canvas save

      // Check exit
      if (posX > canvas.width + 220) {
        setActive(false);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animFrame.current = requestAnimationFrame(render);
    };

    animFrame.current = requestAnimationFrame(render);
  }, [active]);

  // Keyboard shortcut: Tap key 'D'
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "d" || e.key === "D") && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        triggerFlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triggerFlight]);

  // Global event listener
  useEffect(() => {
    const onDragonEvent = () => triggerFlight();
    window.addEventListener("orion:dragon", onDragonEvent);
    if (typeof window !== "undefined" && window.location.search.includes("dragon")) {
      setTimeout(() => triggerFlight(), 200);
    }
    return () => window.removeEventListener("orion:dragon", onDragonEvent);
  }, [triggerFlight]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-50 transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
