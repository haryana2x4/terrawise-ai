import { useEffect, useRef, useState, useCallback } from "react";
import EndermanAvatar, { type EndermanGesture, type BlockType } from "@/components/EndermanAvatar";
import { OrionAI, type OrionReply } from "@/lib/orion-ai";
import { orionVoice, type VoiceSettings } from "@/lib/orion-voice";
import { sound } from "@/lib/sound-effects";
import { translator, SUPPORTED_LANGUAGES, type LanguageInfo } from "@/lib/translator";

interface ScreenEndermanProps {
  className?: string;
}

const QUICK_PROMPTS = [
  { label: "🌾 Root Zone Moisture (SMAP)", q: "What is the NASA SMAP soil moisture level for our farm parcel right now?" },
  { label: "🛰️ NASA Satellites Active", q: "Which NASA Earth observing satellites monitor our agricultural fields?" },
  { label: "🌽 Shift Corn to Sorghum?", q: "How much irrigation water can we save by shifting our fields from corn to sorghum?" },
  { label: "💧 ECOSTRESS Water Deficit", q: "What is the current plant evapotranspiration and drought stress index?" },
  { label: "☀️ Heatwave Alert (POWER)", q: "What is the NASA POWER 7-day temperature, solar irradiance, and rainfall forecast?" },
  { label: "🌱 Soil Carbon & Cover Crops", q: "What are the best climate-resilient cover crops for building soil moisture?" },
  { label: "⚔️ Strike Enderman", q: "Punch me in the face!" },
  { label: "💃 Victory Dance!", q: "Can you celebrate our successful harvest shift?" },
];

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  vy: number;
  life: number;
}

interface FloatingDamage {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number;
}

interface Afterimage {
  id: number;
  x: number;
  y: number;
  alpha: number;
}

interface DimensionalRift {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  type: "departure" | "arrival";
}

export default function ScreenEnderman({ className = "" }: ScreenEndermanProps) {
  // Physics Dimensions
  const charWidth = 180;
  const charHeight = 260;

  // Real Newtonian Physics State
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      return {
        x: Math.max(20, Math.min(window.innerWidth * 0.15, 180)),
        y: Math.max(80, window.innerHeight - charHeight - 250),
      };
    }
    return { x: 140, y: 320 };
  });

  const [gesture, setGesture] = useState<EndermanGesture>("idle");
  const [holdingBlock, setHoldingBlock] = useState<boolean>(true);
  const [blockType, setBlockType] = useState<BlockType>("grass");
  const [auraColor, setAuraColor] = useState<"purple" | "cyan" | "gold" | "rainbow">("purple");
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  // DAMAGE SYSTEM
  const [health, setHealth] = useState<number>(20); // 10 hearts (20 half-hearts)
  const [damageFlash, setDamageFlash] = useState<boolean>(false);
  const [isDead, setIsDead] = useState<boolean>(false);
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);
  const lastDamageTime = useRef<number>(0);
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AFTERIMAGE SYSTEM
  const [afterimages, setAfterimages] = useState<Afterimage[]>([]);

  // DIMENSIONAL RIFT SYSTEM
  const [dimensionalRifts, setDimensionalRifts] = useState<DimensionalRift[]>([]);

  const [speechData, setSpeechData] = useState<{
    text: string;
    originalText?: string;
    source?: string;
    lang?: string;
  }>({
    text: "🌾 Welcome to Field Shift! I am ORION, your farm's NASA Earth Observation Scout. I speak 20+ world languages with instant voice translation so anyone from anywhere on Earth can ask about climate, soil, and crop shifts! Try speaking in your native language or select your flag below.",
    source: "core",
    lang: "en",
  });
  const [selectedLang, setSelectedLang] = useState<string>(() => translator.getLanguage());
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);
  const [voicePitch, setVoicePitch] = useState<number>(() => orionVoice.getSettings().pitch);
  const [voiceRate, setVoiceRate] = useState<number>(() => orionVoice.getSettings().rate);
  const [showOriginalSubtitle, setShowOriginalSubtitle] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [isTeleporting, setIsTeleporting] = useState<boolean>(false);
  const [isHeld, setIsHeld] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Ender Pearl Projectile Flight State
  const [activePearl, setActivePearl] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pearlRef = useRef<{ x: number; y: number; vx: number; vy: number; targetX: number; targetY: number } | null>(null);

  // Physics References (60fps simulation without state lag)
  const physRef = useRef({
    x: 100,
    y: 350,
    vx: 0,
    vy: 0,
    isHeld: false,
    isOnFloor: true,
    lastFloorTime: Date.now(),
    patrolDir: 1,
    dragHistory: [] as Array<{ x: number; y: number; time: number }>,
  });

  const lastTeleportTime = useRef<number>(Date.now());
  const mouseHoverTimer = useRef<number | null>(null);
  const animFrameRef = useRef<number>(0);
  const autoWarpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRenderedPos = useRef({ x: pos.x, y: pos.y });

  // Sync initial position
  useEffect(() => {
    physRef.current.x = pos.x;
    physRef.current.y = pos.y;
  }, []);

  // Spawn portal particles
  const spawnLandingParticles = useCallback((atX: number, atY: number, count = 16, colorHex?: string) => {
    const palette = colorHex
      ? [colorHex, "#ffffff", colorHex]
      : ["#d946ef", "#c026d3", "#a855f7", "#ffffff", "#00f0ff"];
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x: atX + (Math.random() - 0.5) * 80,
      y: atY + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.8) * 8,
      size: Math.random() * 8 + 4,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 1.0,
    }));
    setParticles((prev) => [...prev.slice(-35), ...newParticles]);
  }, []);

  // DIMENSIONAL RIFT EFFECT
  const spawnDimensionalRift = useCallback((x: number, y: number, type: "departure" | "arrival") => {
    const rift: DimensionalRift = {
      id: Date.now() + Math.random(),
      x,
      y,
      radius: 5,
      maxRadius: 70,
      alpha: 1.0,
      type,
    };
    setDimensionalRifts((prev) => [...prev.slice(-3), rift]);
  }, []);

  // Teleportation function with DIMENSIONAL RIFTS
  const teleportTo = useCallback(
    (newX: number, newY: number) => {
      if (isDead) return;
      setIsTeleporting(true);
      sound.playTeleport();

      // Spawn departure rift at current position
      spawnDimensionalRift(
        physRef.current.x + charWidth / 2,
        physRef.current.y + charHeight / 2,
        "departure"
      );
      spawnLandingParticles(physRef.current.x + charWidth / 2, physRef.current.y + charHeight / 2, 24);
      lastTeleportTime.current = Date.now();

      setTimeout(() => {
        physRef.current.x = newX;
        physRef.current.y = newY;
        physRef.current.vx = 0;
        physRef.current.vy = 0;

        // Spawn arrival rift at destination
        spawnDimensionalRift(newX + charWidth / 2, newY + charHeight / 2, "arrival");
        spawnLandingParticles(newX + charWidth / 2, newY + charHeight / 2, 28);
        setIsTeleporting(false);
        setGesture("wave");
        setTimeout(() => setGesture("idle"), 2200);
      }, 260);
    },
    [charHeight, charWidth, isDead, spawnLandingParticles, spawnDimensionalRift],
  );

  // DAMAGE SYSTEM
  const takeDamage = useCallback((amount = 2) => {
    if (isDead) return;
    const now = Date.now();
    if (now - lastDamageTime.current < 500) return; // Invincibility frames
    lastDamageTime.current = now;

    setHealth((prev) => {
      const newHealth = Math.max(0, prev - amount);
      if (newHealth <= 0) {
        // DEATH SEQUENCE
        setIsDead(true);
        setGesture("fall");
        sound.playEnderStare();
        setDamageFlash(true);
        setScreenShake(true);
        setTimeout(() => { setScreenShake(false); setDamageFlash(false); }, 600);

        setSpeechData({
          text: "💀 ELIMINATED! But Endermen always respawn... Give me a moment...",
          source: "core",
        });

        spawnLandingParticles(
          physRef.current.x + charWidth / 2,
          physRef.current.y + charHeight / 2,
          45,
          "#ff0044"
        );

        // Respawn after 2.5s
        setTimeout(() => {
          setIsDead(false);
          setHealth(20);
          setGesture("wave");
          setSpeechData({
            text: "Respawned! You can't get rid of me that easily. I'm immortal code! 😎",
            source: "core",
          });
          spawnLandingParticles(
            physRef.current.x + charWidth / 2,
            physRef.current.y + charHeight / 2,
            30,
            "#00ff88"
          );
          setTimeout(() => setGesture("idle"), 2000);
        }, 2500);

        return 0;
      }
      return newHealth;
    });

    // Damage visual feedback
    setDamageFlash(true);
    setScreenShake(true);
    sound.playGesture();
    spawnLandingParticles(
      physRef.current.x + charWidth / 2,
      physRef.current.y + charHeight / 2,
      20,
      "#ff3333"
    );

    // Spawn floating damage text
    setFloatingDamages((prev) => [
      ...prev.slice(-4),
      {
        id: Date.now() + Math.random(),
        x: physRef.current.x + charWidth / 2,
        y: physRef.current.y + 20,
        text: `-${amount / 2} ❤️`,
        life: 1.0,
      },
    ]);

    // Knockback
    physRef.current.vy = -8;
    physRef.current.vx = (Math.random() - 0.5) * 16;

    setGesture("stare");
    setTimeout(() => { setDamageFlash(false); setScreenShake(false); }, 400);
    setTimeout(() => setGesture("idle"), 1200);

    setSpeechData({
      text: ["Ouch! That hurt! 💥", "Hey! Watch it buddy! 🤕", "You dare strike an Enderman?! ⚡", "Critical hit! But I'm tough! 🛡️"][
        Math.floor(Math.random() * 4)
      ],
      source: "core",
    });

    // Cancel existing regen, start new one after 5s
    if (regenTimerRef.current) clearTimeout(regenTimerRef.current);
    regenTimerRef.current = setTimeout(() => {
      // Auto-regeneration
      const regenInterval = setInterval(() => {
        setHealth((prev) => {
          if (prev >= 20) {
            clearInterval(regenInterval);
            return 20;
          }
          return prev + 1;
        });
      }, 400);
      // Stop regen after 8s max
      setTimeout(() => clearInterval(regenInterval), 8000);
    }, 5000);
  }, [isDead, charWidth, charHeight, spawnLandingParticles]);

  // 100% Safe Landings: Enderman NEVER takes damage on his own
  // Damage is ONLY triggered when the user explicitly attacks or double-clicks him.

  // AUTO-WARP every 12-18s when idle
  useEffect(() => {
    const scheduleAutoWarp = () => {
      const delay = 12000 + Math.random() * 6000;
      autoWarpTimer.current = setTimeout(() => {
        if (!physRef.current.isHeld && physRef.current.isOnFloor && !isDead) {
          const maxX = Math.max(200, window.innerWidth - charWidth - 40);
          const floorY = Math.max(100, window.innerHeight - charHeight - 65);
          const newX = 40 + Math.random() * (maxX - 80);
          teleportTo(newX, floorY);
        }
        scheduleAutoWarp();
      }, delay);
    };

    scheduleAutoWarp();
    return () => {
      if (autoWarpTimer.current) clearTimeout(autoWarpTimer.current);
    };
  }, [charWidth, charHeight, isDead, teleportTo]);

  // --- 1. REAL 60 FPS NEWTONIAN PHYSICS & BALLISTIC PEARL LOOP ---
  useEffect(() => {
    const gravity = 0.64; // Smooth, realistic gravitational pull
    const bounceRestitution = 0.32;
    const friction = 0.985;
    let lastVelocityForAfterimage = 0;

    const tick = () => {
      const phys = physRef.current;
      const floorY = Math.max(100, window.innerHeight - charHeight - 65);
      const maxX = Math.max(200, window.innerWidth - charWidth);

      // --- A. Ballistic Ender Pearl Projectile Simulation ---
      if (pearlRef.current) {
        const p = pearlRef.current;
        p.vy += 0.82;
        p.x += p.vx;
        p.y += p.vy;

        if (Math.random() < 0.6) {
          setParticles((prev) => [
            ...prev.slice(-40),
            {
              id: Math.random(),
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 2.5,
              vy: (Math.random() - 0.5) * 2.5,
              size: 4,
              color: Math.random() > 0.3 ? "#d946ef" : "#22d3ee",
              life: 0.7,
            },
          ]);
        }

        if (p.y >= floorY + 60 || p.x < 15 || p.x > maxX + 50) {
          const impactX = Math.max(20, Math.min(maxX, p.x - charWidth / 2));
          const impactY = Math.min(floorY, Math.max(80, p.y - charHeight));
          pearlRef.current = null;
          setActivePearl(null);
          spawnLandingParticles(impactX + charWidth / 2, impactY + charHeight - 20, 36);
          sound.playTeleport();
          teleportTo(impactX, impactY);
          setSpeechData({
            text: "Ender Pearl impact! Teleportation vector locked!",
            source: "core",
          });
        } else {
          setActivePearl({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
        }
      }

      // --- B. Enderman Entity Newtonian Physics ---
      if (phys.isHeld) {
        phys.isOnFloor = false;
        phys.lastFloorTime = Date.now();
      } else {
        phys.vy += gravity;
        phys.vx *= friction;

        phys.x += phys.vx;
        phys.y += phys.vy;

        // Wall collisions
        if (phys.x < 10) {
          phys.x = 10;
          phys.vx = -phys.vx * bounceRestitution;
          sound.playGesture();
        }
        if (phys.x > maxX) {
          phys.x = maxX;
          phys.vx = -phys.vx * bounceRestitution;
          sound.playGesture();
        }

        // Ceiling
        if (phys.y < 40) {
          phys.y = 40;
          phys.vy = Math.abs(phys.vy) * 0.3;
        }

        // Floor Collision (100% Safe Landing - NEVER take damage on his own!)
        if (phys.y >= floorY) {
          phys.y = floorY;
          const impactSpeed = phys.vy;

          if (Math.abs(impactSpeed) > 5) {
            // High or medium drop: soft agricultural particle puff + slight playful bounce, ZERO DAMAGE!
            spawnLandingParticles(phys.x + charWidth / 2, floorY + charHeight - 20, 12, "#10b981");
            sound.playGesture();
            phys.vy = -phys.vy * (bounceRestitution * 0.7);
          } else {
            // Minimal fall or idle stepping: soft footfall, ZERO DAMAGE!
            phys.vy = 0;
            phys.vx *= 0.85;
            if (!phys.isOnFloor) {
              phys.isOnFloor = true;
              phys.lastFloorTime = Date.now();
              setGesture("idle");
            }
          }
        } else {
          phys.isOnFloor = false;
          if (Math.abs(phys.vy) > 2) {
            setGesture("fall");
          }
        }

        // Autonomous Floor Patrol
        if (phys.isOnFloor && !isSpeaking && Date.now() - phys.lastFloorTime > 3500) {
          setGesture("walk");
          phys.x += phys.patrolDir * 1.2;

          if (phys.x > maxX - 60) phys.patrolDir = -1;
          if (phys.x < 30) phys.patrolDir = 1;

          if (Math.random() < 0.004) {
            phys.lastFloorTime = Date.now() + 2000;
            setGesture("idle");
          }
        }
      }

      // AFTERIMAGE TRAIL when velocity > 6
      const velocity = Math.hypot(phys.vx, phys.vy);
      if (velocity > 6 && Math.abs(velocity - lastVelocityForAfterimage) > 0.5) {
        setAfterimages((prev) => [
          ...prev.slice(-8),
          {
            id: Date.now() + Math.random(),
            x: phys.x,
            y: phys.y,
            alpha: 0.5,
          },
        ]);
      }
      lastVelocityForAfterimage = velocity;

      if (
        Math.abs(phys.x - lastRenderedPos.current.x) > 0.4 ||
        Math.abs(phys.y - lastRenderedPos.current.y) > 0.4
      ) {
        lastRenderedPos.current = { x: phys.x, y: phys.y };
        setPos({ x: phys.x, y: phys.y });
      }

      // Particle physics update (early return if empty prevents unnecessary React re-renders)
      setParticles((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vx: p.vx * 0.94,
            vy: p.vy * 0.94 + 0.15,
            life: p.life - 0.035,
          }))
          .filter((p) => p.life > 0);
      });

      // Floating Hearts update
      setHearts((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((h) => ({
            ...h,
            y: h.y + h.vy,
            life: h.life - 0.025,
          }))
          .filter((h) => h.life > 0);
      });

      // Floating Damage Text update (rises and fades)
      setFloatingDamages((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((d) => ({
            ...d,
            y: d.y - 1.4,
            life: d.life - 0.025,
          }))
          .filter((d) => d.life > 0);
      });

      // Afterimage fade
      setAfterimages((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((a) => ({ ...a, alpha: a.alpha - 0.04 }))
          .filter((a) => a.alpha > 0);
      });

      // Dimensional rift animation
      setDimensionalRifts((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((r) => ({
            ...r,
            radius: Math.min(r.maxRadius, r.radius + 3),
            alpha: r.alpha - 0.025,
          }))
          .filter((r) => r.alpha > 0);
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [charHeight, charWidth, isSpeaking, spawnLandingParticles, teleportTo]);

  // --- 2. DRAG & FLING PHYSICS ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement)?.closest("input, button, a")) return;
    if (isDead) return;

    physRef.current.isHeld = true;
    physRef.current.vx = 0;
    physRef.current.vy = 0;
    physRef.current.dragHistory = [{ x: e.clientX, y: e.clientY, time: performance.now() }];

    setIsHeld(true);
    setGesture("fall");
    sound.playGesture();

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!physRef.current.isHeld) return;

    const now = performance.now();
    const history = physRef.current.dragHistory;
    history.push({ x: e.clientX, y: e.clientY, time: now });
    if (history.length > 5) history.shift();

    const targetX = e.clientX - charWidth / 2;
    const targetY = e.clientY - charHeight / 2;

    physRef.current.x = targetX;
    physRef.current.y = targetY;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!physRef.current.isHeld) return;

    physRef.current.isHeld = false;
    setIsHeld(false);

    const history = physRef.current.dragHistory;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const dt = Math.max(16, last.time - first.time);
      const throwVx = ((last.x - first.x) / dt) * 13;
      const throwVy = ((last.y - first.y) / dt) * 13;

      physRef.current.vx = Math.max(-20, Math.min(20, throwVx));
      physRef.current.vy = Math.max(-20, Math.min(20, throwVy));
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // DOUBLE-CLICK to ATTACK
  const handleDoubleClick = useCallback(() => {
    takeDamage(2);
  }, [takeDamage]);

  // --- 3. AUTONOMOUS CURSOR TELEPORTATION ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (physRef.current.isHeld || pearlRef.current || isDead) return;

      if (mouseHoverTimer.current) {
        clearTimeout(mouseHoverTimer.current);
      }

      mouseHoverTimer.current = window.setTimeout(() => {
        const now = Date.now();
        if (now - lastTeleportTime.current < 6000) return;

        const targetX = Math.max(
          20,
          Math.min(window.innerWidth - charWidth - 20, e.clientX + (e.clientX > window.innerWidth / 2 ? -charWidth - 40 : 40)),
        );
        const targetY = Math.max(70, Math.min(window.innerHeight - charHeight - 60, e.clientY - 120));

        const dist = Math.hypot(targetX - physRef.current.x, targetY - physRef.current.y);
        if (dist > 300) {
          teleportTo(targetX, targetY);
        }
      }, 2600);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mouseHoverTimer.current) clearTimeout(mouseHoverTimer.current);
    };
  }, [charHeight, charWidth, isDead, teleportTo]);

  // --- 4. INTERACTIVE ACTIONS ---

  // Toss Ender Pearl
  const tossEnderPearl = (towardsX?: number, towardsY?: number) => {
    if (pearlRef.current || isDead) return;
    const startX = physRef.current.x + charWidth / 2;
    const startY = physRef.current.y + 70;
    const tx = towardsX ?? (startX + (Math.random() > 0.5 ? 340 : -340));
    const ty = towardsY ?? (window.innerHeight - 180);

    const dx = tx - startX;
    const dy = ty - startY;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 19;

    pearlRef.current = {
      x: startX,
      y: startY,
      vx: (dx / dist) * speed,
      vy: Math.min(-7, (dy / dist) * speed - 6),
      targetX: tx,
      targetY: ty,
    };
    setActivePearl({ x: startX, y: startY, vx: pearlRef.current.vx, vy: pearlRef.current.vy });
    sound.playPearlThrow();
    setGesture("point");
    setSpeechData({ text: "Tossing an Ender Pearl! Watch it arc across the sky — where it lands, I teleport!", source: "core" });
  };

  // Block Holding & Cycling
  const cycleBlock = () => {
    if (isDead) return;
    sound.playChirp();
    if (!holdingBlock) {
      setHoldingBlock(true);
      setBlockType("grass");
      setSpeechData({ text: "Holding a fresh patch of Earth grass! Smells like home.", source: "core" });
      return;
    }
    if (blockType === "grass") {
      setBlockType("tnt");
      setSpeechData({ text: "TNT block equipped! Handle with care, no sparks or flint & steel allowed!", source: "core" });
    } else if (blockType === "tnt") {
      setBlockType("ender_chest");
      setSpeechData({ text: "Ender Chest locked & loaded! Access to the End void dimension.", source: "core" });
    } else if (blockType === "ender_chest") {
      setBlockType("cosmic_core");
      setSpeechData({ text: "Beyond Earth Ion Core charged at 100%! Ready for orbital insertion.", source: "core" });
    } else {
      setHoldingBlock(false);
      setSpeechData({ text: "Dropped block. Arms free and ready to grab or salute!", source: "core" });
    }
  };

  // Aura Color Cycling
  const cycleAura = () => {
    sound.playChirp();
    const sequence: Array<"purple" | "cyan" | "gold" | "rainbow"> = ["purple", "cyan", "gold", "rainbow"];
    const nextIdx = (sequence.indexOf(auraColor) + 1) % sequence.length;
    const nextAura = sequence[nextIdx];
    setAuraColor(nextAura);
    const names = {
      purple: "Void Purple (Authentic Minecraft)",
      cyan: "Cosmic Cyan (Spaceflight Dust)",
      gold: "Solar Amber (Countdown Flare)",
      rainbow: "Rainbow Prism (RGB Quantum)",
    };
    setSpeechData({ text: `Aura shifted to ${names[nextAura]}!`, source: "core" });
  };

  // Eye-Contact Stare Rage Mode
  const triggerStareAggro = () => {
    if (isDead) return;
    setGesture("stare");
    sound.playEnderStare();
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 1400);
    spawnLandingParticles(physRef.current.x + charWidth / 2, physRef.current.y + 60, 40, "#ff0055");
    physRef.current.vy = -7;
    setSpeechData({ text: "⚠️ AGGRO DETECTED: RULE #1: NEVER STARE DIRECTLY INTO AN ENDERMAN'S EYES!", source: "core" });
    setTimeout(() => setGesture("idle"), 2800);
  };

  // Petting / Head Scratch
  const handlePetHead = () => {
    if (isDead) return;
    sound.playPetChirp();
    setGesture("nod");
    const newHearts: FloatingHeart[] = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i + Math.random(),
      x: physRef.current.x + charWidth / 2 + (Math.random() - 0.5) * 60,
      y: physRef.current.y + 40,
      vy: -(Math.random() * 2 + 1.5),
      life: 1.0,
    }));
    setHearts((prev) => [...prev, ...newHearts]);
    setSpeechData({ text: "Awww, that tickles! 💖 Endermen usually avoid touch, but you're my best buddy!", source: "core" });

    // Petting heals 2 HP
    setHealth((prev) => Math.min(20, prev + 2));

    setTimeout(() => setGesture("idle"), 2400);
  };

  // Beatbox & Dance
  const handleBeatbox = () => {
    if (isDead) return;
    sound.playBeatboxBeat();
    setGesture("dance");
    setSpeechData({ text: "Dropping that 60 FPS End-dimension beatbox! 8-bit kick, sub-bass, hi-hat!", source: "core" });
    setTimeout(() => setGesture("idle"), 3400);
  };

  // Summon Ender Dragon
  const handleDragon = () => {
    window.dispatchEvent(new CustomEvent("orion:dragon"));
    setGesture("salute");
    setSpeechData({ text: "Look up! That's Jean the Ender Dragon cruising through orbital space!", source: "core" });
    setTimeout(() => setGesture("wave"), 2000);
  };

  // Rocket Jump
  const handleRocketJump = () => {
    if (isDead) return;
    physRef.current.vy = -23;
    physRef.current.vx = (Math.random() - 0.5) * 12;
    sound.playGesture();
    spawnLandingParticles(physRef.current.x + charWidth / 2, physRef.current.y + charHeight - 20, 24);
    setGesture("fall");
    setSpeechData({ text: "Zero-G Rocket Jump! Catch me on the descent!", source: "core" });
  };

  // Instant Random Teleport
  const handleInstantTeleport = () => {
    if (isDead) return;
    const maxX = Math.max(200, window.innerWidth - charWidth - 40);
    const floorY = Math.max(100, window.innerHeight - charHeight - 65);
    const newX = 40 + Math.random() * (maxX - 80);
    const newY = 80 + Math.random() * (floorY - 120);
    teleportTo(newX, newY);
    setSpeechData({ text: "Dimensional warp engaged! ✨ You can't predict where I'll appear!", source: "core" });
  };

  // Jump poke
  const handlePokeJump = () => {
    if (!physRef.current.isHeld && physRef.current.isOnFloor && !isDead) {
      physRef.current.vy = -14;
      physRef.current.vx = (Math.random() - 0.5) * 8;
      sound.playGesture();
      setGesture("salute");
      setTimeout(() => setGesture("idle"), 1800);
    }
  };

  // --- 5. GLOBAL KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "e") { e.preventDefault(); tossEnderPearl(); }
      else if (key === "b") { e.preventDefault(); cycleBlock(); }
      else if (key === "s") { e.preventDefault(); triggerStareAggro(); }
      else if (key === "p") { e.preventDefault(); handlePetHead(); }
      else if (key === "m") { e.preventDefault(); handleBeatbox(); }
      else if (key === "d") { e.preventDefault(); handleDragon(); }
      else if (key === "t") { e.preventDefault(); handleInstantTeleport(); }
      else if (key === " " && !e.repeat) { e.preventDefault(); handleRocketJump(); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [holdingBlock, blockType, auraColor, isDead]);

  // Synchronize language changes
  useEffect(() => {
    const unsub = translator.subscribe((lang) => {
      setSelectedLang(lang);
    });
    return unsub;
  }, []);

  // --- 6. SUPERCHARGED INTELLIGENCE ANSWER ENGINE WITH MULTILINGUAL TRANSLATION ---
  const askQuestion = async (query: string) => {
    const q = query.trim();
    if (!q) return;

    setInputValue("");
    sound.playChirp();
    setIsSearching(true);
    setIsSpeaking(true);
    setSpeechData({ text: "Consulting neural matrix & universal translation…", source: "core" });

    try {
      const response: OrionReply = await OrionAI.answer(q, undefined, selectedLang);
      setIsSearching(false);
      setGesture(response.gesture);

      if (response.gesture === "teleport") {
        sound.playTeleport();
        spawnLandingParticles(physRef.current.x + charWidth / 2, physRef.current.y + charHeight / 2, 25);
      } else if (response.gesture === "stare") {
        sound.playEnderStare();
      } else if (response.gesture === "dance") {
        sound.playBeatboxBeat();
      } else if (response.gesture === "fall") {
        physRef.current.vy = -14;
      }

      setSpeechData({
        text: response.text,
        originalText: response.originalText,
        source: response.source,
        lang: response.lang || selectedLang,
      });

      orionVoice.speak(response.text, {
        onEnd: () => setIsSpeaking(false),
        lang: response.lang || selectedLang,
      });
    } catch {
      setIsSearching(false);
      setSpeechData({ text: "Hey buddy! My uplink dropped a packet. Give me another try!", source: "core" });
      setIsSpeaking(false);
    }
  };

  // Multilingual Speech Recognition (Voice Input)
  const toggleVoiceRecognition = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const fallbackPrompt =
        selectedLang === "hi"
          ? "आज खाना खाया?"
          : selectedLang === "es"
            ? "¿Tienes comida hoy?"
            : selectedLang === "fr"
              ? "Tu as mangé aujourd'hui?"
              : "You have food today?";
      askQuestion(fallbackPrompt);
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const activeLang = translator.getActiveLanguageInfo();
      recognition.lang = activeLang.bcp47;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      sound.playChirp();
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) askQuestion(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Preview Voice in chosen language
  const handlePreviewVoice = (code = selectedLang) => {
    sound.playChirp();
    setIsSpeaking(true);
    orionVoice.previewVoice(code, () => {
      setIsSpeaking(false);
    });
  };

  // Apply voice pitch & rate tuning
  const handlePitchChange = (val: number) => {
    setVoicePitch(val);
    orionVoice.saveSettings({ pitch: val });
  };

  const handleRateChange = (val: number) => {
    setVoiceRate(val);
    orionVoice.saveSettings({ rate: val });
  };

  const blockNames: Record<BlockType, string> = {
    grass: "Grass",
    tnt: "TNT",
    ender_chest: "Chest",
    cosmic_core: "Core",
  };

  // Render health bar
  const renderHealthBar = () => {
    const fullHearts = Math.floor(health / 2);
    const halfHeart = health % 2 === 1;
    const emptyHearts = 10 - fullHearts - (halfHeart ? 1 : 0);
    return (
      <div className="flex items-center gap-0.5 text-[11px]" title={`Health: ${health}/20`}>
        {Array.from({ length: fullHearts }, (_, i) => (
          <span key={`f${i}`} className="drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]">❤️</span>
        ))}
        {halfHeart && <span className="opacity-60 drop-shadow-[0_0_3px_rgba(239,68,68,0.5)]">❤️</span>}
        {Array.from({ length: emptyHearts }, (_, i) => (
          <span key={`e${i}`} className="opacity-30">🖤</span>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Screen Shake (screen-wide red tint removed) */}
      {screenShake ? <div className="pointer-events-none fixed inset-0 z-50 screen-shake" /> : null}

      {/* DIMENSIONAL RIFT PORTALS */}
      {dimensionalRifts.map((rift) => (
        <div
          key={rift.id}
          className="pointer-events-none fixed z-45"
          style={{
            left: `${rift.x}px`,
            top: `${rift.y}px`,
            width: `${rift.radius * 2}px`,
            height: `${rift.radius * 2}px`,
            marginLeft: `-${rift.radius}px`,
            marginTop: `-${rift.radius}px`,
            borderRadius: "50%",
            border: `2px solid ${rift.type === "departure" ? "rgba(168, 85, 247, " + rift.alpha + ")" : "rgba(6, 182, 212, " + rift.alpha + ")"}`,
            boxShadow: `0 0 ${rift.radius}px ${rift.type === "departure" ? "rgba(168, 85, 247, " + rift.alpha * 0.6 + ")" : "rgba(6, 182, 212, " + rift.alpha * 0.6 + ")"}, inset 0 0 ${rift.radius / 2}px ${rift.type === "departure" ? "rgba(168, 85, 247, " + rift.alpha * 0.3 + ")" : "rgba(6, 182, 212, " + rift.alpha * 0.3 + ")"}`,
            opacity: rift.alpha,
            background: `radial-gradient(circle, ${rift.type === "departure" ? "rgba(88, 28, 135, " + rift.alpha * 0.25 + ")" : "rgba(8, 51, 68, " + rift.alpha * 0.25 + ")"} 0%, transparent 70%)`,
          }}
        />
      ))}

      {/* AFTERIMAGE GHOST TRAILS (Lightweight CSS silhouette without spawning duplicate 3D WebGL contexts) */}
      {afterimages.map((ai) => (
        <div
          key={ai.id}
          className="pointer-events-none fixed z-35 flex items-center justify-center"
          style={{
            left: `${ai.x}px`,
            top: `${ai.y}px`,
            width: `${charWidth}px`,
            height: `${charHeight}px`,
            opacity: ai.alpha * 0.45,
            filter: "drop-shadow(0 0 16px rgba(217, 70, 239, 0.75)) blur(1px)",
          }}
        >
          <div className="h-44 w-14 rounded-full bg-gradient-to-b from-purple-500/80 via-fuchsia-600/35 to-transparent" />
        </div>
      ))}

      {/* Trailing Landing & Teleport Particle Dust */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed z-50 rounded-sm"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      ))}

      {/* Floating Pet Hearts */}
      {hearts.map((h) => (
        <div
          key={h.id}
          className="pointer-events-none fixed z-50 text-[18px] text-pink-400 select-none drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]"
          style={{
            left: `${h.x}px`,
            top: `${h.y}px`,
            opacity: h.life,
            transform: `scale(${h.life})`,
          }}
        >
          ❤️
        </div>
      ))}

      {/* Floating Damage Indicators (Damage & Fall Damage) */}
      {floatingDamages.map((d) => (
        <div
          key={d.id}
          className="pointer-events-none fixed z-[60] font-mono text-[14px] font-black tracking-wider text-rose-300 select-none drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]"
          style={{
            left: `${d.x}px`,
            top: `${d.y}px`,
            opacity: d.life,
            transform: `translate(-50%, -50%) scale(${0.85 + d.life * 0.35})`,
          }}
        >
          {d.text}
        </div>
      ))}

      {/* Ballistic Ender Pearl Projectile */}
      {activePearl ? (
        <div
          className="pointer-events-none fixed z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200 bg-gradient-to-br from-teal-300 via-cyan-600 to-purple-900 shadow-[0_0_16px_#06b6d4,0_0_24px_#a855f7] animate-pulse"
          style={{ left: `${activePearl.x}px`, top: `${activePearl.y}px` }}
        >
          <div className="h-full w-full rounded-full border border-white/50 animate-spin" />
        </div>
      ) : null}

      {/* Living 3D Minecraft Enderman (UNCAGED) */}
      <div
        className={`fixed z-40 select-none ${className}`}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${charWidth}px`,
          height: `${charHeight}px`,
          touchAction: "none",
          filter: isDead
            ? "grayscale(1) brightness(0.4)"
            : damageFlash
              ? "drop-shadow(0 0 35px #ef4444) drop-shadow(0 0 12px #ff0033)"
              : "none",
          transition: "filter 0.15s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <div className="relative h-full w-full">
          {/* Red Damage Flash ONLY on the Enderman (Screen remains clear) */}
          {damageFlash && (
            <div
              className="pointer-events-none absolute inset-0 z-30 rounded-3xl animate-pulse"
              style={{
                backgroundColor: "rgba(255, 0, 40, 0.45)",
                boxShadow: "inset 0 0 30px rgba(255, 0, 40, 0.9)",
              }}
            />
          )}
          {/* Floating Speech Bubble Above Head */}
          {speechData.text ? (
            <div
              className="absolute bottom-[104%] left-1/2 -translate-x-1/2 z-50 w-[370px] rounded-2xl border border-cyan-400/70 bg-gradient-to-b from-[#0c142c]/95 to-[#080d1e]/95 p-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(6,182,212,0.3)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-cyan-500/30 text-[10px] font-mono tracking-wider uppercase">
                <span className="flex items-center gap-1.5 font-bold text-cyan-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  ORION
                  <span className="rounded bg-cyan-500/30 px-1.5 py-0.2 text-[9px] text-cyan-200 border border-cyan-500/50 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-ping" />
                    GEMMA 4
                  </span>
                  {speechData.lang && speechData.lang !== "en" && (
                    <span className="rounded bg-emerald-500/30 px-1.5 py-0.2 text-[9px] text-emerald-200 border border-emerald-500/40">
                      🌐 {speechData.lang.toUpperCase()}
                    </span>
                  )}
                  {speechData.source === "live_search" && (
                    <span className="rounded bg-purple-500/30 px-1.5 py-0.2 text-[9px] text-purple-200 border border-purple-500/40">
                      LIVE WEB
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playChirp();
                      setIsSpeaking(true);
                      orionVoice.speak(speechData.text, {
                        onEnd: () => setIsSpeaking(false),
                        lang: speechData.lang || selectedLang,
                      });
                    }}
                    className="rounded bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 hover:bg-emerald-800 hover:text-white border border-emerald-500/40 transition-all"
                    title="Replay Voice in Selected Language"
                  >
                    🔊
                  </button>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("open:brain"))}
                    className="rounded bg-cyan-950/80 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 hover:bg-cyan-800 hover:text-white border border-cyan-500/40 transition-all"
                    title="Visualize Gemma 4 Point-Cloud Brain Scan"
                  >
                    🧠 Brain
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      orionVoice.stop();
                      setSpeechData({ text: "" });
                      setIsSpeaking(false);
                    }}
                    className="text-zinc-400 hover:text-white ml-1"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-[#f3ebfc] font-medium">
                {speechData.text}
              </p>
              {speechData.originalText && speechData.originalText !== speechData.text && (
                <div className="mt-2 pt-1.5 border-t border-cyan-500/20">
                  <button
                    type="button"
                    onClick={() => setShowOriginalSubtitle(!showOriginalSubtitle)}
                    className="text-[10px] font-mono text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1 underline underline-offset-2"
                  >
                    <span>{showOriginalSubtitle ? "▼ Hide English" : "► Show English Source"}</span>
                  </button>
                  {showOriginalSubtitle && (
                    <p className="mt-1 text-[11.5px] italic text-zinc-300 font-mono leading-normal bg-black/40 p-2 rounded-lg border border-cyan-900/40">
                      {speechData.originalText}
                    </p>
                  )}
                </div>
              )}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-[#080d1e]" />
            </div>
          ) : null}

          {/* Pure 3D Minecraft Rig */}
          <div
            className={`h-full w-full transition-opacity duration-200 ${
              isTeleporting ? "opacity-15 blur-sm" : "opacity-100"
            } ${isHeld ? "cursor-grabbing scale-105" : "cursor-grab"} ${isDead ? "rotate-90 scale-75" : ""}`}
            onClick={handlePokeJump}
            title="Living AI Enderman - Drag & throw me, hover over eyes for aggro, scrub head to pet, double-click to attack!"
          >
            <EndermanAvatar
              mood={isSpeaking ? "speaking" : isDead ? "idle" : "idle"}
              gesture={gesture}
              onGestureChange={setGesture}
              interactive={!isDead}
              showControls={false}
              holdingBlock={holdingBlock}
              blockType={blockType}
              auraColor={auraColor}
              onEyeContact={triggerStareAggro}
              onPetHead={handlePetHead}
              damageFlash={damageFlash}
            />
          </div>

          {/* Teleport Flash */}
          {isTeleporting ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-fuchsia-500/30 rounded-full blur-md animate-ping">
              <span className="text-[11px] font-mono tracking-widest text-fuchsia-200 uppercase font-bold">
                [ WARP ]
              </span>
            </div>
          ) : null}

          {/* Floating Drag & Toss Hint */}
          <div className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 flex justify-center whitespace-nowrap">
            <span className="rounded-full border border-cyan-400/40 bg-[#060a18]/85 px-3 py-0.5 text-[9px] font-mono font-bold tracking-wider text-cyan-200 uppercase shadow-[0_0_10px_rgba(6,182,212,0.4)]">
              {isDead ? "💀 RESPAWNING..." : isHeld ? "🔥 FLING HIGH · WATCH FALL DAMAGE!" : "DRAG · FLING · FALL DAMAGE · [T] WARP"}
            </span>
          </div>
        </div>
      </div>

      {/* 5. DOCKED COMPANION COMMAND CONSOLE */}
      <div className="fixed bottom-6 left-6 z-40 w-[400px] rounded-2xl border border-cyan-500/40 bg-gradient-to-b from-[#0b1226]/95 to-[#060a18]/95 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(6,182,212,0.2)] backdrop-blur-2xl">
        {/* Header with Health Bar & Brain Link */}
        <div className="mb-2 flex items-center justify-between border-b border-cyan-500/20 pb-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ENDERMAN POWERS
            </span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("open:brain"))}
              className="flex items-center gap-1 rounded bg-cyan-950/80 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 hover:text-white transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)]"
              title="Open Gemma 4 Point-Cloud Brain Scan"
            >
              🧠 Gemma 4 Brain
            </button>
          </div>
          {renderHealthBar()}
        </div>

        {/* 🌐 Universal Language & Better Voice Engine Bar */}
        <div className="mb-2 flex items-center justify-between gap-1.5 rounded-xl border border-cyan-500/40 bg-[#070e22]/95 p-1.5 backdrop-blur shadow-[0_0_12px_rgba(6,182,212,0.15)] text-[10px] font-mono">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[13px] leading-none shrink-0" title="Universal World Language Selector">🌐</span>
            <select
              value={selectedLang}
              onChange={(e) => {
                const newLang = e.target.value;
                setSelectedLang(newLang);
                translator.setLanguage(newLang);
                sound.playChirp();
              }}
              className="w-full truncate rounded-lg bg-cyan-950/90 px-2 py-1 text-[10.5px] font-mono font-bold text-cyan-200 border border-cyan-500/50 outline-none hover:border-cyan-300 focus:border-cyan-200 transition-all cursor-pointer shadow-inner"
              title="Select your native language (20+ supported world languages with voice & translation)"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#050812] text-white">
                  {l.flag} {l.nativeName} ({l.name})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handlePreviewVoice()}
              className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-950 to-teal-950 px-2.5 py-1 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/60 hover:text-white hover:border-emerald-400 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              title="Test Voice in Selected Language"
            >
              <span>🔊</span>
              <span>Test</span>
            </button>

            <button
              type="button"
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`rounded-lg px-2 py-1 text-[10px] font-mono border transition-all ${
                showVoiceSettings
                  ? "bg-cyan-500/30 text-cyan-200 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                  : "bg-zinc-900/70 text-zinc-400 border-zinc-700/70 hover:text-white hover:border-zinc-500"
              }`}
              title="Voice Pitch & Speed Tuning"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Voice Tuning Sliders Popup */}
        {showVoiceSettings && (
          <div className="mb-2.5 rounded-xl border border-cyan-500/40 bg-[#060a18] p-2.5 text-[10px] font-mono space-y-2 animate-in fade-in zoom-in-95 duration-150 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-cyan-900/60 pb-1">
              <span>🎛️ ENDERMAN VOICE TUNING</span>
              <span className="text-[9px] text-emerald-300 font-bold">{selectedLang.toUpperCase()} MODE</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-300">Pitch ({voicePitch.toFixed(2)})</span>
              <input
                type="range"
                min="0.5"
                max="1.3"
                step="0.02"
                value={voicePitch}
                onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                className="w-32 accent-cyan-400 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-300">Speed ({voiceRate.toFixed(2)}x)</span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={voiceRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-32 accent-cyan-400 cursor-pointer"
              />
            </div>
            <div className="text-[8.5px] text-zinc-400 italic">
              ✨ Procedural Web Audio sub-bass resonance filter active.
            </div>
          </div>
        )}

        <div className="mb-1 text-right text-[8px] text-zinc-500 font-mono">
          [B] [E] [S] [P] [M] [D] [T] [SPACE]
        </div>

        {/* 2x5 Quick Action Grid */}
        <div className="mb-2.5 grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={cycleBlock}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5 px-1 text-[9px] font-mono font-bold transition-all ${
              holdingBlock
                ? "border-amber-500/70 bg-amber-500/20 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "border-zinc-700/60 bg-zinc-900/60 text-zinc-400 hover:text-white"
            }`}
            title="Carry / Cycle Block [B]"
          >
            <span>📦</span>
            <span className="truncate">{holdingBlock ? blockNames[blockType] : "Block"}</span>
          </button>

          <button
            type="button"
            onClick={() => tossEnderPearl()}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-purple-500/60 bg-purple-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-purple-200 hover:bg-purple-900/70 hover:text-white transition-all"
            title="Toss Ender Pearl [E]"
          >
            <span>🔮</span>
            <span>Pearl</span>
          </button>

          <button
            type="button"
            onClick={triggerStareAggro}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-red-500/60 bg-red-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-red-200 hover:bg-red-900/70 hover:text-white transition-all"
            title="Aggro Stare Mode [S]"
          >
            <span>⚠️</span>
            <span>Stare</span>
          </button>

          <button
            type="button"
            onClick={handlePetHead}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-pink-500/60 bg-pink-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-pink-200 hover:bg-pink-900/70 hover:text-white transition-all"
            title="Pet Head (heals +2) [P]"
          >
            <span>❤️</span>
            <span>Pet</span>
          </button>

          <button
            type="button"
            onClick={handleBeatbox}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-cyan-500/60 bg-cyan-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-cyan-200 hover:bg-cyan-900/70 hover:text-white transition-all"
            title="Beatbox & Dance [M]"
          >
            <span>🎵</span>
            <span>Beat</span>
          </button>

          <button
            type="button"
            onClick={cycleAura}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-indigo-500/60 bg-indigo-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-indigo-200 hover:bg-indigo-900/70 hover:text-white transition-all"
            title="Cycle Aura Color"
          >
            <span>🌈</span>
            <span className="capitalize">{auraColor}</span>
          </button>

          <button
            type="button"
            onClick={handleDragon}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-violet-500/60 bg-violet-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-violet-200 hover:bg-violet-900/70 hover:text-white transition-all"
            title="Summon Ender Dragon [D]"
          >
            <span>🐉</span>
            <span>Dragon</span>
          </button>

          <button
            type="button"
            onClick={handleRocketJump}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-500/60 bg-emerald-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-emerald-200 hover:bg-emerald-900/70 hover:text-white transition-all"
            title="Rocket Fling [Space]"
          >
            <span>🚀</span>
            <span>Fling</span>
          </button>

          <button
            type="button"
            onClick={handleInstantTeleport}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-fuchsia-500/60 bg-fuchsia-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-fuchsia-200 hover:bg-fuchsia-900/70 hover:text-white transition-all"
            title="Instant Teleport [T]"
          >
            <span>⚡</span>
            <span>Warp</span>
          </button>

          <button
            type="button"
            onClick={() => takeDamage(2)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-orange-500/60 bg-orange-950/50 py-1.5 px-1 text-[9px] font-mono font-bold text-orange-200 hover:bg-orange-900/70 hover:text-white transition-all"
            title="Attack Enderman (2x click also works)"
          >
            <span>⚔️</span>
            <span>Hit</span>
          </button>
        </div>

        {/* Ask Question Form with Universal Voice & Translation */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(inputValue);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-[#050812] px-3 py-1.5 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              selectedLang === "auto"
                ? "Ask in any language (English, Español, हिन्दी, 日本語)..."
                : `Ask ORION in ${translator.getActiveLanguageInfo().nativeName}...`
            }
            className="w-full bg-transparent py-1 text-[13px] text-white outline-none placeholder:text-cyan-500/60"
          />
          <button
            type="button"
            onClick={toggleVoiceRecognition}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-mono font-bold transition-all ${
              isListening
                ? "bg-red-600 text-white animate-pulse shadow-[0_0_14px_#ef4444]"
                : "bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 hover:bg-cyan-900 hover:text-white"
            }`}
            title={`Voice Input in ${translator.getActiveLanguageInfo().nativeName} (${translator.getActiveLanguageInfo().bcp47})`}
          >
            <span>🎤</span>
            <span className="text-[9px] uppercase">{selectedLang}</span>
          </button>
          <button
            type="submit"
            disabled={!inputValue.trim() || isSearching}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-1 text-[11px] font-mono font-bold text-white shadow-[0_0_12px_rgba(6,182,212,0.45)] hover:brightness-110 disabled:opacity-40"
            title="Send query"
          >
            {isSearching ? "…" : "↵"}
          </button>
        </form>

        {/* Quick Prompt Chips */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => askQuestion(p.q)}
              className="truncate rounded-md border border-cyan-800/40 bg-[#091024] px-2 py-0.5 text-[10px] font-mono text-cyan-200 hover:border-cyan-400 hover:text-white transition-all shadow-[0_0_6px_rgba(6,182,212,0.15)]"
              title={p.q}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
