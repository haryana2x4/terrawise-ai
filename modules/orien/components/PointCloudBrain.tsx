import { useEffect, useRef, useState } from "react";

interface PointCloudBrainProps {
  className?: string;
  onClose?: () => void;
  isOpen?: boolean;
}

interface BrainNode {
  // Base brain shape coordinates (normalized -1 to 1)
  bx: number;
  by: number;
  bz: number;
  region: "frontal" | "parietal" | "temporal" | "occipital" | "cerebellum" | "core";
  
  // Scatter target in the constellation of signal
  cx: number;
  cy: number;
  cz: number;

  // Current dynamic 3D position
  x: number;
  y: number;
  z: number;

  size: number;
  color: string;
  activePulse: number;
}

interface SignalPulse {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
  color: string;
}

export default function PointCloudBrain({ className = "", onClose, isOpen = true }: PointCloudBrainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"scan" | "scatter">("scan");
  const [activeRegion, setActiveRegion] = useState("Frontal Lobe");
  const [scanTelemetry, setScanTelemetry] = useState("Ingesting NASA SMAP Soil Moisture...");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Generate ~1,600 Brain Nodes with anatomical gyri, sulci, and two distinct hemispheres
    const NODE_COUNT = 1600;
    const nodes: BrainNode[] = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      // Hemisphere: Left (-1) or Right (+1)
      const hemisphere = i % 2 === 0 ? 1 : -1;
      
      // Spherical coordinates
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      // Anatomical brain ellipsoid stretching
      const rx = 0.72; // width
      const ry = 0.85; // height
      const rz = 1.05; // front-to-back elongation

      // Cortex gyri & sulci modulation (brain folds)
      const gyrus = 1.0 + 0.08 * Math.sin(theta * 7) * Math.cos(phi * 8) + 0.05 * Math.sin(phi * 12);

      let bx = Math.sin(phi) * Math.cos(theta) * rx * gyrus;
      let by = Math.cos(phi) * ry * gyrus;
      let bz = Math.sin(phi) * Math.sin(theta) * rz * gyrus;

      // Split into Left and Right cerebral hemispheres (interhemispheric fissure)
      bx = hemisphere * (0.09 + Math.abs(bx) * 0.9);

      // Flatten inferior base and shape cerebellum
      if (by < -0.3 && bz < -0.1) {
        // Cerebellum region
        by = by * 0.85 - 0.15;
        bz = bz * 0.85 - 0.2;
      }

      // Indent temporal lobe fossa
      if (by < 0.1 && Math.abs(bx) > 0.4 && bz > -0.2 && bz < 0.3) {
        bx *= 0.85;
      }

      // Classify anatomical region based on 3D coordinates
      let region: BrainNode["region"] = "core";
      let color = "16, 185, 129"; // Emerald

      if (bz > 0.22) {
        region = "frontal";
        color = "6, 182, 212"; // Cyan (Decision planning)
      } else if (by > 0.25 && bz >= -0.25) {
        region = "parietal";
        color = "56, 189, 248"; // Sky blue (Sensory NASA mapping)
      } else if (by < 0.15 && Math.abs(bx) > 0.35 && bz >= -0.35) {
        region = "temporal";
        color = "168, 85, 247"; // Violet (Gemma 4 Neural Memory)
      } else if (bz < -0.3 && by >= -0.2) {
        region = "occipital";
        color = "245, 158, 11"; // Amber (Visual satellite spectrometry)
      } else if (by < -0.25 && bz < -0.15) {
        region = "cerebellum";
        color = "249, 115, 22"; // Orange (Motor physics & coordination)
      } else {
        region = "core";
        color = "255, 255, 255";
      }

      // Constellation target coordinates (exploded, living signal galaxy)
      const scatterDist = 1.8 + Math.pow(Math.random(), 0.5) * 2.8;
      const sTheta = Math.random() * Math.PI * 2;
      const sPhi = Math.acos(2.0 * Math.random() - 1.0);
      const cx = Math.sin(sPhi) * Math.cos(sTheta) * scatterDist;
      const cy = Math.cos(sPhi) * scatterDist * 0.8;
      const cz = Math.sin(sPhi) * Math.sin(sTheta) * scatterDist;

      nodes.push({
        bx: bx * 210,
        by: by * 210,
        bz: bz * 210,
        region,
        cx: cx * 320,
        cy: cy * 320,
        cz: cz * 320,
        x: bx * 210,
        y: by * 210,
        z: bz * 210,
        size: Math.random() * 2.2 + 1.2,
        color,
        activePulse: 0,
      });
    }

    // Dynamic Signal Pulses (Constellation signals traveling along neural links)
    const signals: SignalPulse[] = [];
    for (let s = 0; s < 45; s++) {
      const from = Math.floor(Math.random() * NODE_COUNT);
      signals.push({
        fromNode: from,
        toNode: (from + Math.floor(Math.random() * 80) + 1) % NODE_COUNT,
        progress: Math.random(),
        speed: 0.008 + Math.random() * 0.015,
        color: Math.random() > 0.5 ? "255, 255, 255" : "6, 182, 212",
      });
    }

    // Scan & Animation State
    let scanZ = 220; // Glides from +Z (frontal) to -Z (occipital/cerebellum)
    let scanDirection = -1;
    let transitionProgress = 0; // 0 = Brain Shape, 1 = Scattered Constellation
    let rotationY = 0;
    let rotationX = 0.12;
    let animFrame = 0;
    let cycleTimer = 0;

    const onResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // 60 FPS Render Loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const centerX = width * 0.5;
      const centerY = height * 0.5;

      // Mode transition: 0 = Point-Cloud Brain, 1 = Living Constellation of Signal
      const targetTransition = mode === "scatter" ? 1.0 : 0.0;
      transitionProgress += (targetTransition - transitionProgress) * 0.045;

      // Rotation & glide
      rotationY += 0.004;
      rotationX = 0.15 + Math.sin(rotationY * 0.5) * 0.05;

      // Scan plane motion (glides region by region)
      if (mode === "scan") {
        scanZ += scanDirection * 2.8;
        if (scanZ < -240) {
          scanDirection = 1;
        } else if (scanZ > 240) {
          scanDirection = -1;
        }

        // Update Region HUD based on scan plane Z
        if (scanZ > 80) {
          setActiveRegion("Frontal Lobe");
          setScanTelemetry("Gemma 4: Crop Shift Optimization & Climate Heuristics");
        } else if (scanZ > 0) {
          setActiveRegion("Parietal Cortex");
          setScanTelemetry("NASA SMAP: L-Band Root-Zone Hydration Vectors");
        } else if (scanZ > -90) {
          setActiveRegion("Temporal & Hippocampus");
          setScanTelemetry("ECOSTRESS: Evapotranspiration Historical Archive");
        } else {
          setActiveRegion("Occipital & Cerebellar Complex");
          setScanTelemetry("MODIS / Landsat 9: Canopy NDVI Spectral Imaging");
        }
      }

      // Auto cycle: after 8 seconds of scanning, automatically lets go into constellation
      cycleTimer++;
      if (cycleTimer > 600 && mode === "scan") {
        setMode("scatter");
        cycleTimer = 0;
      } else if (cycleTimer > 500 && mode === "scatter") {
        setMode("scan");
        cycleTimer = 0;
      }

      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);

      // Projected Nodes Array for Drawing
      const projected: Array<{ sx: number; sy: number; scale: number; node: BrainNode; inScan: boolean }> = [];

      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];

        // Position interpolation: from brain coordinates (bx, by, bz) to constellation (cx, cy, cz)
        const t = transitionProgress;
        const targetX = n.bx * (1 - t) + n.cx * t;
        const targetY = n.by * (1 - t) + n.cy * t;
        const targetZ = n.bz * (1 - t) + n.cz * t;

        // Apply gentle breathing jitter in constellation mode
        const jitter = t * Math.sin(rotationY * 2 + i) * 8;
        n.x = targetX + jitter;
        n.y = targetY;
        n.z = targetZ;

        // 3D rotation
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;

        // Perspective projection
        const focal = 600;
        const scale = focal / (focal + z2 + 350);
        const sx = centerX + x1 * scale;
        const sy = centerY + y1 * scale;

        // Check if node is currently in the laser scan glide
        const distFromScan = Math.abs(n.bz - scanZ);
        const inScan = distFromScan < 26 && mode === "scan";

        projected.push({ sx, sy, scale, node: n, inScan });
      }

      // 1. Draw Scanning Laser Sheet (Gliding region-by-region in brain mode)
      if (mode === "scan" && transitionProgress < 0.3) {
        const scanY1 = centerY - 140;
        const scanY2 = centerY + 140;
        const scanXCenter = centerX + scanZ * 0.4 * cosY;

        ctx.save();
        const scanGrad = ctx.createLinearGradient(scanXCenter - 80, scanY1, scanXCenter + 80, scanY2);
        scanGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
        scanGrad.addColorStop(0.5, "rgba(16, 185, 129, 0.45)");
        scanGrad.addColorStop(1, "rgba(6, 182, 212, 0)");

        ctx.fillStyle = scanGrad;
        ctx.fillRect(scanXCenter - 120, scanY1, 240, scanY2 - scanY1);

        // Bright laser scanning line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scanXCenter - 100, scanY1);
        ctx.lineTo(scanXCenter + 100, scanY2);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw Living Constellation Links & Neural Filaments
      if (transitionProgress > 0.25) {
        const linkAlpha = (transitionProgress - 0.25) * 0.32;
        ctx.lineWidth = 0.8;

        for (let i = 0; i < 280; i++) {
          const a = projected[i * 5];
          const b = projected[(i * 5 + 17) % NODE_COUNT];
          if (!a || !b) continue;

          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const dist = Math.hypot(dx, dy);

          if (dist < 110) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${(1 - dist / 110) * linkAlpha})`;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }

        // Draw Traveling Signal Pulses across the Constellation Links
        for (const sig of signals) {
          sig.progress += sig.speed;
          if (sig.progress >= 1.0) {
            sig.progress = 0;
            sig.fromNode = Math.floor(Math.random() * NODE_COUNT);
            sig.toNode = (sig.fromNode + Math.floor(Math.random() * 60) + 1) % NODE_COUNT;
          }

          const fromP = projected[sig.fromNode];
          const toP = projected[sig.toNode];
          if (fromP && toP) {
            const px = fromP.sx + (toP.sx - fromP.sx) * sig.progress;
            const py = fromP.sy + (toP.sy - fromP.sy) * sig.progress;

            ctx.beginPath();
            ctx.fillStyle = `rgba(${sig.color}, ${0.85 * transitionProgress})`;
            ctx.arc(px, py, 2.5 * fromP.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 3. Draw All 1,600 Point-Cloud Brain Nodes
      for (const p of projected) {
        const { sx, sy, scale, node, inScan } = p;

        let alpha = 0.45 * scale;
        let radius = node.size * scale;
        let rgb = node.color;

        // When illuminated by the gliding scan:
        if (inScan) {
          alpha = 0.95;
          radius *= 2.2;
          rgb = "255, 255, 255";
        }

        // Extra radiance in constellation mode
        if (transitionProgress > 0.4) {
          alpha = Math.min(0.9, alpha * 1.35);
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        ctx.arc(sx, sy, Math.max(0.8, radius), 0, Math.PI * 2);
        ctx.fill();

        // Glowing corona for active scanned nodes
        if (inScan) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(6, 182, 212, 0.45)`;
          ctx.arc(sx, sy, radius * 2.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", onResize);
    };
  }, [mode]);

  if (!isOpen) return null;

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-cyan-500/40 bg-[#040c1a]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(6,182,212,0.3)] backdrop-blur-3xl ${className}`}>
      {/* Top HUD Telemetry Header */}
      <div className="z-10 flex w-full items-center justify-between border-b border-cyan-500/25 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-3 w-3 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <span className="block text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
              ORION GEMMA 4 · NEURAL BRAIN CORE
            </span>
            <span className="block text-[10px] font-mono text-zinc-400">
              {mode === "scan" ? `REGION SCAN: ${activeRegion}` : "CONSTELLATION OF SIGNAL: SCATTERED & LIVING"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setMode(mode === "scan" ? "scatter" : "scan")}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-950/60 px-3 py-1.5 text-[11px] font-mono font-bold text-cyan-200 shadow-sm hover:bg-cyan-900/60 hover:text-white transition-all"
          >
            {mode === "scan" ? "🌌 Scatter to Constellation" : "🧠 Coalesce to Brain Scan"}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              title="Close Neural Visualizer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* The Luminous Point Cloud Brain Canvas */}
      <div className="relative h-[340px] w-full sm:h-[400px]">
        <canvas ref={canvasRef} className="h-full w-full select-none" />

        {/* Dynamic Telemetry Overlay in bottom corner */}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-emerald-500/30 bg-[#051222]/85 px-3 py-1.5 text-[10.5px] font-mono text-emerald-300 backdrop-blur shadow-sm">
          <span className="text-zinc-400 font-bold">STATUS: </span>
          {scanTelemetry}
        </div>
      </div>

      {/* Narrative Caption */}
      <div className="z-10 mt-2 text-center text-[11px] font-mono text-zinc-300 italic">
        "A luminous point-cloud brain hangs in the dark while the scan glides region by region — then lets go, scattering into a living constellation of signal."
      </div>
    </div>
  );
}
