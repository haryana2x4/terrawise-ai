import { useEffect, useRef, useState, useCallback, memo } from "react";
import { sound } from "@/lib/sound-effects";
import { orionVoice } from "@/lib/orion-voice";

export type EndermanMood = "idle" | "thinking" | "speaking" | "offline";
export type EndermanGesture =
  | "idle"
  | "wave"
  | "point"
  | "stare"
  | "teleport"
  | "thinking"
  | "nod"
  | "salute"
  | "walk"
  | "fall"
  | "dance";

export type BlockType = "grass" | "tnt" | "ender_chest" | "cosmic_core";

export interface EndermanAvatarProps {
  mood?: EndermanMood;
  gesture?: EndermanGesture;
  onGestureChange?: (gesture: EndermanGesture) => void;
  interactive?: boolean;
  showControls?: boolean;
  holdingBlock?: boolean;
  blockType?: BlockType;
  auraColor?: "purple" | "cyan" | "gold" | "rainbow";
  onEyeContact?: () => void;
  onPetHead?: () => void;
  className?: string;
  damageFlash?: boolean;
}

type ThreeGlobal = {
  Scene: new () => any;
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => any;
  WebGLRenderer: new (options: Record<string, unknown>) => any;
  BoxGeometry: new (w: number, h: number, d: number) => any;
  MeshStandardMaterial: new (options: Record<string, unknown>) => any;
  MeshBasicMaterial: new (options: Record<string, unknown>) => any;
  Mesh: new (geometry: unknown, material: unknown) => any;
  Group: new () => any;
  HemisphereLight: new (sky: number, ground: number, intensity: number) => any;
  DirectionalLight: new (color: number, intensity: number) => any;
  PointLight: new (color: number, intensity: number, distance: number) => any;
  Color: new (hex: number) => any;
  Vector3: new (x: number, y: number, z: number) => any;
  sRGBEncoding: number;
};

declare global {
  interface Window {
    THREE?: ThreeGlobal;
  }
}

const SCRIPT_SRC = "/vendor/three.min.js";
const PROFILE_SRC = "/characters/enderman.sunday";

let threePromise: Promise<ThreeGlobal | null> | null = null;

function loadThree(): Promise<ThreeGlobal | null> {
  if (typeof window !== "undefined" && window.THREE) return Promise.resolve(window.THREE);
  if (threePromise) return threePromise;
  threePromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.THREE ?? null);
    script.onerror = () => {
      // Fallback to CDN for standalone / netlify deployment if local vendor path is missing
      const cdnScript = document.createElement("script");
      cdnScript.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      cdnScript.async = true;
      cdnScript.onload = () => resolve(window.THREE ?? null);
      cdnScript.onerror = () => resolve(null);
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
  return threePromise;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Authentic Minecraft Enderman Voxel Rig with Articulating Jaw
 * - 3-block Minecraft proportions with slender obsidian limbs
 * - Split head structure: Upper head + articulating lower jaw for true lip sync & Ender Stare
 * - Glowing magenta slit eyes with white pupils
 * - 48 drifting purple voxel portal particles
 * - Multi-axis mouse tracking and 3D orbit dragging
 */
function buildEnderman(THREE: ThreeGlobal) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.85, 6.6);
  camera.lookAt(new THREE.Vector3(0, 1.85, 0));

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.88, metalness: 0.04 }),
    body: new THREE.MeshStandardMaterial({ color: 0x08080d, roughness: 0.92, metalness: 0.02 }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x040407 }),
    sclera: new THREE.MeshBasicMaterial({ color: 0xd946ef }),
    pupil: new THREE.MeshBasicMaterial({ color: 0xfdf4ff }),
  };

  const root = new THREE.Group();
  scene.add(root);

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 2.3;
  root.add(torso);

  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.8), materials.skin);
  torsoMesh.scale.set(0.55, 0.625, 0.5);
  torso.add(torsoMesh);

  // Head Pivot
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.52, 0);
  torso.add(headPivot);

  // Split Head: Upper Skull (carries eyes)
  const upperHead = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 1.1), materials.skin);
  upperHead.scale.set(0.64, 0.64, 0.64);
  upperHead.position.set(0, 0.44, 0);
  headPivot.add(upperHead);

  // Split Head: Articulating Lower Jaw (drops for speech & stares)
  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.38, 1.08), materials.skin);
  lowerJaw.scale.set(0.63, 0.63, 0.63);
  lowerJaw.position.set(0, 0.16, 0.02);
  headPivot.add(lowerJaw);

  // Dark mouth interior cavity
  const mouthCavity = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.44, 0.96), materials.mouth);
  mouthCavity.scale.set(0.62, 0.62, 0.62);
  mouthCavity.position.set(0, 0.3, 0);
  headPivot.add(mouthCavity);

  // Eyes (mounted on upper skull)
  const scleraGeo = new THREE.BoxGeometry(0.24, 0.16, 0.04);
  const pupilGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);

  const leftSclera = new THREE.Mesh(scleraGeo, materials.sclera);
  leftSclera.scale.set(1.5, 0.6, 1);
  leftSclera.position.set(-0.24, -0.04, 0.62);
  upperHead.add(leftSclera);

  const rightSclera = new THREE.Mesh(scleraGeo, materials.sclera);
  rightSclera.scale.set(1.5, 0.6, 1);
  rightSclera.position.set(0.24, -0.04, 0.62);
  upperHead.add(rightSclera);

  const leftEye = new THREE.Mesh(pupilGeo, materials.pupil);
  leftEye.scale.set(0.6, 0.32, 1);
  leftEye.position.set(-0.24, -0.04, 0.66);
  upperHead.add(leftEye);

  const rightEye = new THREE.Mesh(pupilGeo, materials.pupil);
  rightEye.scale.set(0.6, 0.32, 1);
  rightEye.position.set(0.24, -0.04, 0.66);
  upperHead.add(rightEye);

  // Slender Enderman Arms
  const armGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);
  const legGeo = new THREE.BoxGeometry(0.52, 1.6, 0.55);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.42, 0.42, 0);
  torso.add(leftArmPivot);
  const leftArm = new THREE.Mesh(armGeo, materials.body);
  leftArm.scale.set(0.36, 1.25, 0.36);
  leftArm.position.set(0, -0.92, 0);
  leftArmPivot.add(leftArm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.42, 0.42, 0);
  torso.add(rightArmPivot);
  const rightArm = new THREE.Mesh(armGeo, materials.body);
  rightArm.scale.set(0.36, 1.25, 0.36);
  rightArm.position.set(0, -0.92, 0);
  rightArmPivot.add(rightArm);

  // Slender Enderman Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, -0.5, 0);
  torso.add(leftLegPivot);
  const leftLeg = new THREE.Mesh(legGeo, materials.body);
  leftLeg.scale.set(0.36, 1.15, 0.36);
  leftLeg.position.set(0, -0.9, 0);
  leftLegPivot.add(leftLeg);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.16, -0.5, 0);
  torso.add(rightLegPivot);
  const rightLeg = new THREE.Mesh(legGeo, materials.body);
  rightLeg.scale.set(0.36, 1.15, 0.36);
  rightLeg.position.set(0, -0.9, 0);
  rightLegPivot.add(rightLeg);

  // 48 Drifting Ender Portal Particles with dynamic color support
  const particles = new THREE.Group();
  root.add(particles);
  const particleGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

  const particleMeshes: any[] = [];
  for (let i = 0; i < 48; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: [0xd946ef, 0xa855f7, 0xf5d0fe][i % 3] });
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.userData = {
      baseX: (Math.random() - 0.5) * 2.2,
      baseY: Math.random() * 3.8,
      baseZ: (Math.random() - 0.5) * 2.2,
      speed: Math.random() * 1.1 + 0.6,
      twinkle: Math.random() * Math.PI * 2,
    };
    mesh.position.set(mesh.userData.baseX, mesh.userData.baseY, mesh.userData.baseZ);
    particles.add(mesh);
    particleMeshes.push(mesh);
  }

  // Authentic Minecraft Voxel Blocks held in hands
  const blockGroup = new THREE.Group();
  blockGroup.position.set(0, -0.08, 0.48);
  torso.add(blockGroup);

  // 1. Grass Block (Classic Dirt + Grass Top)
  const blockGrass = new THREE.Group();
  blockGroup.add(blockGrass);
  const grassDirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.68, 0.68),
    new THREE.MeshStandardMaterial({ color: 0x543216, roughness: 0.9 })
  );
  blockGrass.add(grassDirt);
  const grassTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.18, 0.70),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 })
  );
  grassTop.position.set(0, 0.26, 0);
  blockGrass.add(grassTop);

  // 2. TNT Block (Red Cube + White Label Band + Fuse)
  const blockTnt = new THREE.Group();
  blockGroup.add(blockTnt);
  const tntBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.68, 0.68),
    new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.7 })
  );
  blockTnt.add(tntBody);
  const tntBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.22, 0.70),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 })
  );
  blockTnt.add(tntBand);
  const tntFuse = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 })
  );
  tntFuse.position.set(0, 0.4, 0);
  blockTnt.add(tntFuse);

  // 3. Ender Chest (Dark Teal Obsidian + Gold Latch + Glowing Eye)
  const blockChest = new THREE.Group();
  blockGroup.add(blockChest);
  const chestBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.66, 0.66),
    new THREE.MeshStandardMaterial({ color: 0x0e2830, roughness: 0.5, metalness: 0.2 })
  );
  blockChest.add(chestBody);
  const chestLatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.8 })
  );
  chestLatch.position.set(0, 0, 0.35);
  blockChest.add(chestLatch);
  const chestEye = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  chestEye.position.set(0, 0.1, 0.35);
  blockChest.add(chestEye);

  // 4. Cosmic Core (Glowing Electric Cyan Core + Metallic Wireframe)
  const blockCore = new THREE.Group();
  blockGroup.add(blockCore);
  const coreBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.62, 0.62),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  );
  blockCore.add(coreBody);
  const coreFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.68, 0.68),
    new THREE.MeshStandardMaterial({ color: 0xf0b64a, wireframe: true })
  );
  blockCore.add(coreFrame);

  blockGroup.visible = false;

  // Lighting
  scene.add(new THREE.HemisphereLight(0x7585b2, 0x05060d, 0.35));
  const key = new THREE.DirectionalLight(0xcde0ff, 0.5);
  key.position.set(2.6, 4.4, 4.2);
  scene.add(key);

  const rim = new THREE.PointLight(0xd946ef, 1.9, 14);
  rim.position.set(-2.2, 2.6, -2.4);
  scene.add(rim);

  const fill = new THREE.PointLight(0x7c5cff, 0.6, 12);
  fill.position.set(2.4, 1.4, 1.6);
  scene.add(fill);

  return {
    scene,
    camera,
    root,
    torso,
    headPivot,
    upperHead,
    lowerJaw,
    mouthCavity,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftEye,
    rightEye,
    leftSclera,
    rightSclera,
    blockGroup,
    blockGrass,
    blockTnt,
    blockChest,
    blockCore,
    particleMeshes,
    rim,
    materials,
  };
}

function EndermanFallback({ mood }: { mood: EndermanMood }) {
  const dim = mood === "offline";
  return (
    <svg viewBox="0 0 120 200" className="h-full w-full" role="img" aria-label="ORION Enderman Avatar">
      <g fill={dim ? "#15151c" : "#0d0d14"}>
        <rect x="44" y="24" width="32" height="32" />
        <rect x="46" y="58" width="28" height="62" />
        <rect x="38" y="60" width="7" height="72" />
        <rect x="75" y="60" width="7" height="72" />
        <rect x="48" y="122" width="9" height="56" />
        <rect x="63" y="122" width="9" height="56" />
      </g>
      <g fill={dim ? "#5b2b6b" : "#d946ef"}>
        <rect x="49" y="36" width="9" height="3" />
        <rect x="62" y="36" width="9" height="3" />
      </g>
      <g fill="#a855f7" opacity={dim ? 0.25 : 0.7}>
        <rect x="30" y="18" width="4" height="4" />
        <rect x="84" y="46" width="4" height="4" />
        <rect x="24" y="96" width="3" height="3" />
        <rect x="92" y="112" width="3" height="3" />
        <rect x="40" y="150" width="3" height="3" />
      </g>
    </svg>
  );
}

function EndermanAvatar({
  mood = "idle",
  gesture = "idle",
  onGestureChange,
  interactive = true,
  showControls = true,
  holdingBlock = false,
  blockType = "grass",
  auraColor = "purple",
  onEyeContact,
  onPetHead,
  className = "",
  damageFlash = false,
}: EndermanAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef(mood);
  const gestureRef = useRef(gesture);
  const holdingBlockRef = useRef(holdingBlock);
  const blockTypeRef = useRef(blockType);
  const auraColorRef = useRef(auraColor);
  const onEyeContactRef = useRef(onEyeContact);
  const onPetHeadRef = useRef(onPetHead);
  const damageFlashRef = useRef(damageFlash);
  damageFlashRef.current = damageFlash;
  const [ready, setReady] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<EndermanGesture>(gesture);
  const [isHovered, setIsHovered] = useState(false);
  const [teleporting, setTeleporting] = useState(false);

  moodRef.current = mood;
  gestureRef.current = currentGesture;
  holdingBlockRef.current = holdingBlock;
  blockTypeRef.current = blockType;
  auraColorRef.current = auraColor;
  onEyeContactRef.current = onEyeContact;
  onPetHeadRef.current = onPetHead;
  damageFlashRef.current = damageFlash;
  const shownGesture = useRef(currentGesture);

  // Chat, mouse, and the wandering figure all push gestures through this prop.
  useEffect(() => {
    if (!gesture || gesture === shownGesture.current) return;
    shownGesture.current = gesture;
    setCurrentGesture(gesture);
    if (gesture === "teleport") {
      setTeleporting(true);
      window.setTimeout(() => setTeleporting(false), 650);
    }
  }, [gesture]);

  const triggerGesture = useCallback(
    (g: EndermanGesture) => {
      shownGesture.current = g;
      setCurrentGesture(g);
      onGestureChange?.(g);

      if (g === "wave") {
        sound.playGesture();
      } else if (g === "stare") {
        sound.playEnderStare();
      } else if (g === "salute" || g === "point") {
        sound.playChirp();
      } else if (g === "teleport") {
        setTeleporting(true);
        sound.playTeleport();
        setTimeout(() => setTeleporting(false), 650);
      }

      // Return to idle automatically after gesture finishes (unless stare or idle)
      if (g !== "idle" && g !== "stare") {
        const duration = g === "wave" ? 3200 : g === "teleport" ? 1400 : 2500;
        setTimeout(() => {
          shownGesture.current = "idle";
          setCurrentGesture("idle");
          onGestureChange?.("idle");
        }, duration);
      }
    },
    [onGestureChange],
  );

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    void loadThree().then((THREE) => {
      if (disposed || !THREE) return;
      const host = hostRef.current;
      if (!host) return;

      let renderer: any;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return;
      }
      if (!renderer) return;

      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      const rig = buildEnderman(THREE);
      const reduced = prefersReducedMotion();

      const resize = () => {
        const width = host.clientWidth || 1;
        const height = host.clientHeight || 1;
        renderer.setSize(width, height, false);
        rig.camera.aspect = width / height;
        rig.camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(host);

      let breath = 0;
      let blink = 0;
      let speakingTime = 0;
      let gestureTime = 0;
      let visible = true;
      let lipAmp = 0;
      let eyePulse = 1.0;

      // Subscribe to real-time lip sync from ORION voice engine
      const unsubLipSync = orionVoice.subscribeLipSync((amplitude, pulse) => {
        lipAmp = amplitude;
        eyePulse = pulse;
      });

      const visibility = new IntersectionObserver(
        (entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
        },
        { threshold: 0.05 },
      );
      visibility.observe(host);

      // Mouse Look and Orbit Drag
      const look = { x: 0, y: 0 };
      const orbit = { yaw: 0, targetYaw: 0, isDragging: false, lastX: 0 };
      const eyeContactTimer = { current: 0 };
      const stareFired = { current: false };
      const petScrubDist = { current: 0 };
      const lastPetTime = { current: 0 };
      const lastPetX = { current: 0 };

      const onPointer = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        look.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        look.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        if (orbit.isDragging) {
          const deltaX = event.clientX - orbit.lastX;
          orbit.targetYaw += deltaX * 0.015;
          orbit.lastX = event.clientX;
        }

        // Real-time Stare & Head Petting Detection
        const nowMs = performance.now();
        const relY = (event.clientY - rect.top) / rect.height; // 0 (top) to 1 (bottom)
        const relX = (event.clientX - rect.left) / rect.width;

        if (relY > 0.06 && relY < 0.44 && Math.abs(relX - 0.5) < 0.35) {
          // Direct Eye Contact detection (> 1.1s hover triggers aggro stare!)
          if (eyeContactTimer.current === 0) {
            eyeContactTimer.current = nowMs;
          } else if (nowMs - eyeContactTimer.current > 1100 && !stareFired.current) {
            stareFired.current = true;
            onEyeContactRef.current?.();
          }

          // Petting / Head Scrubbing (> 120px movement across top of head)
          if (relY < 0.28) {
            const dx = Math.abs(event.clientX - lastPetX.current);
            lastPetX.current = event.clientX;
            petScrubDist.current += dx;
            if (petScrubDist.current > 120 && nowMs - lastPetTime.current > 1100) {
              lastPetTime.current = nowMs;
              petScrubDist.current = 0;
              onPetHeadRef.current?.();
            }
          }
        } else {
          eyeContactTimer.current = 0;
          stareFired.current = false;
        }
      };

      const onPointerDown = (event: PointerEvent) => {
        orbit.isDragging = true;
        orbit.lastX = event.clientX;
      };

      const onPointerUp = () => {
        orbit.isDragging = false;
      };

      host.addEventListener("pointermove", onPointer);
      host.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);

      const clock = { last: performance.now() };

      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const delta = Math.min((now - clock.last) / 1000, 0.05);
        clock.last = now;
        if (!visible) return;

        const currentMood = moodRef.current;
        const activeGesture = gestureRef.current;
        const isSpeaking = currentMood === "speaking" || orionVoice.isSpeaking() || lipAmp > 0.05;

        breath += delta * (isSpeaking ? 3.4 : 2.0);
        speakingTime += delta;
        gestureTime += delta;

        // Smooth orbit dampening
        if (!orbit.isDragging) {
          orbit.targetYaw += (0 - orbit.targetYaw) * 0.04;
        }
        orbit.yaw += (orbit.targetYaw - orbit.yaw) * 0.15;
        rig.root.rotation.y = orbit.yaw;

        // Torso idle float
        rig.torso.position.y = 2.3 + Math.sin(breath) * 0.025;

        // Head tracking
        let targetYaw = look.x * 0.38;
        let targetPitch = -look.y * 0.24;
        let targetRoll = 0;

        if (currentMood === "thinking" || activeGesture === "thinking") {
          targetYaw += Math.sin(breath * 0.6) * 0.18;
          targetPitch += 0.14;
          targetRoll = -0.16;
        }

        if (activeGesture === "stare") {
          targetPitch = 0.22; // Tilt head back slightly
          targetYaw += (Math.random() - 0.5) * 0.04; // Aggro shudder
        }

        if (activeGesture === "nod") {
          targetPitch += Math.sin(gestureTime * 7) * 0.18;
        }

        if (activeGesture === "wave") {
          targetRoll = 0.09;
        }

        rig.headPivot.rotation.y += (targetYaw - rig.headPivot.rotation.y) * 0.14;
        rig.headPivot.rotation.x += (targetPitch - rig.headPivot.rotation.x) * 0.14;
        rig.headPivot.rotation.z += (targetRoll - rig.headPivot.rotation.z) * 0.14;

        // Jaw Articulation (True Phonetic Lip-Sync & Ender Stare)
        let jawDrop = 0;
        let jawAngle = 0;

        if (activeGesture === "stare") {
          jawDrop = 0.38; // Unhinged jaw
          jawAngle = -0.32;
        } else if (isSpeaking) {
          jawDrop = lipAmp * 0.28 + Math.max(0, Math.sin(speakingTime * 12) * 0.06);
          jawAngle = -jawDrop * 0.65;
        }

        rig.lowerJaw.position.y = 0.16 - jawDrop;
        rig.lowerJaw.rotation.x = jawAngle;
        rig.mouthCavity.scale.y = 0.62 + jawDrop * 0.5;

        // Arm & Leg Gestures
        let leftArmRotX = 0;
        let leftArmRotZ = 0;
        let rightArmRotX = 0;
        let rightArmRotZ = 0;
        let leftLegRotX = 0;
        let rightLegRotX = 0;

        // Natural sway base
        const sway = isSpeaking ? Math.sin(speakingTime * 3.1) * 0.16 : Math.sin(breath * 0.8) * 0.03;
        leftArmRotZ = sway;
        rightArmRotZ = -sway;

        if (activeGesture === "wave") {
          rightArmRotX = -2.35; // Arm up
          rightArmRotZ = Math.sin(gestureTime * 8) * 0.35 + 0.3; // Wave hand
        } else if (activeGesture === "point") {
          rightArmRotX = -1.48; // Arm forward
          rightArmRotZ = 0.18;
          leftArmRotX = 0.2;
        } else if (activeGesture === "salute") {
          rightArmRotX = -2.15; // Crisp military salute at temple
          rightArmRotZ = -0.62;
        } else if (activeGesture === "thinking") {
          leftArmRotX = -1.82; // Hand to chin
          leftArmRotZ = 0.52;
        } else if (activeGesture === "stare") {
          leftArmRotZ = 0.28; // Tense flared posture
          rightArmRotZ = -0.28;
          leftArmRotX = -0.15;
          rightArmRotX = -0.15;
        } else if (activeGesture === "walk") {
          const walkCycle = gestureTime * 7;
          leftLegRotX = Math.sin(walkCycle) * 0.45;
          rightLegRotX = -Math.sin(walkCycle) * 0.45;
          leftArmRotX = -Math.sin(walkCycle) * 0.42;
          rightArmRotX = Math.sin(walkCycle) * 0.42;
        } else if (activeGesture === "fall") {
          leftArmRotZ = 0.85; // Arms flailing up in the air!
          rightArmRotZ = -0.85;
          leftArmRotX = -1.35;
          rightArmRotX = -1.35;
          leftLegRotX = 0.4;
          rightLegRotX = -0.3;
          targetPitch = 0.35; // Looking down at ground
        } else if (activeGesture === "dance") {
          const danceCycle = gestureTime * 6;
          targetRoll = Math.sin(danceCycle) * 0.22;
          targetYaw = Math.cos(danceCycle * 0.5) * 0.3;
          leftArmRotZ = Math.sin(danceCycle) * 0.5 + 0.3;
          rightArmRotZ = -Math.cos(danceCycle) * 0.5 - 0.3;
          leftArmRotX = Math.cos(danceCycle) * 0.45;
          rightArmRotX = Math.sin(danceCycle) * 0.45;
          leftLegRotX = Math.sin(danceCycle) * 0.25;
          rightLegRotX = -Math.sin(danceCycle) * 0.25;
        }

        // Block Holding Kinematics & Mesh Visibility
        const isHolding = Boolean(holdingBlockRef.current);
        const currentBlock = blockTypeRef.current || "grass";
        rig.blockGroup.visible = isHolding;

        if (isHolding) {
          rig.blockGrass.visible = currentBlock === "grass";
          rig.blockTnt.visible = currentBlock === "tnt";
          rig.blockChest.visible = currentBlock === "ender_chest";
          rig.blockCore.visible = currentBlock === "cosmic_core";

          // Hold block out in front with both hands
          leftArmRotX = -1.45;
          leftArmRotZ = 0.22;
          rightArmRotX = -1.45;
          rightArmRotZ = -0.22;
          rig.blockGroup.position.y = -0.08 + Math.sin(breath * 1.6) * 0.02;
        }

        rig.leftArmPivot.rotation.x += (leftArmRotX - rig.leftArmPivot.rotation.x) * 0.15;
        rig.leftArmPivot.rotation.z += (leftArmRotZ - rig.leftArmPivot.rotation.z) * 0.15;
        rig.rightArmPivot.rotation.x += (rightArmRotX - rig.rightArmPivot.rotation.x) * 0.15;
        rig.rightArmPivot.rotation.z += (rightArmRotZ - rig.rightArmPivot.rotation.z) * 0.15;
        if (rig.leftLegPivot) {
          rig.leftLegPivot.rotation.x += (leftLegRotX - rig.leftLegPivot.rotation.x) * 0.2;
        }
        if (rig.rightLegPivot) {
          rig.rightLegPivot.rotation.x += (rightLegRotX - rig.rightLegPivot.rotation.x) * 0.2;
        }

        // Eyes & Glow
        blink += delta;
        const eyeScale = activeGesture === "stare" ? 1.4 : blink % 4.4 < 0.16 ? 0.08 : 1;
        rig.leftEye.scale.y = 0.32 * eyeScale * eyePulse;
        rig.rightEye.scale.y = 0.32 * eyeScale * eyePulse;
        rig.leftSclera.scale.y = 0.45 * eyeScale;
        rig.rightSclera.scale.y = 0.45 * eyeScale;

        // Dynamic Aura & Rim Lighting
        const currentAura = auraColorRef.current || "purple";

        // Authentic Minecraft Mob Damage Red Tint
        if (damageFlashRef.current) {
          rig.materials.skin.color.setHex(0xff1828);
          rig.materials.body.color.setHex(0xdd1020);
          rig.materials.mouth.color.setHex(0x990011);
          if (rig.materials.skin.emissive) rig.materials.skin.emissive.setHex(0xbb0020);
          if (rig.materials.body.emissive) rig.materials.body.emissive.setHex(0xbb0020);
          rig.rim.color.setHex(0xff0033);
          rig.rim.intensity = 5.5;
        } else {
          rig.materials.skin.color.setHex(0x0c0c12);
          rig.materials.body.color.setHex(0x08080d);
          rig.materials.mouth.color.setHex(0x040407);
          if (rig.materials.skin.emissive) rig.materials.skin.emissive.setHex(0x000000);
          if (rig.materials.body.emissive) rig.materials.body.emissive.setHex(0x000000);

          if (currentAura === "cyan") {
            rig.rim.color.setHex(0x00f0ff);
          } else if (currentAura === "gold") {
            rig.rim.color.setHex(0xffb703);
          } else if (currentAura === "rainbow") {
            const h = (now * 0.0003) % 1.0;
            rig.rim.color.setHSL(h, 0.9, 0.6);
          } else {
            rig.rim.color.setHex(activeGesture === "stare" ? 0xff0055 : 0xd946ef);
          }
        }

        // Stare vs Normal Eye Color
        if (activeGesture === "stare") {
          rig.materials.pupil.color.setHex(0xffffff);
          rig.materials.sclera.color.setHex(0xff0055);
          rig.rim.intensity = 4.8;
        } else {
          rig.materials.pupil.color.setHex(0xfdf4ff);
          rig.materials.sclera.color.setHex(currentAura === "cyan" ? 0x06b6d4 : currentAura === "gold" ? 0xf59e0b : 0xd946ef);
          rig.rim.intensity = isSpeaking ? 2.6 : currentMood === "offline" ? 0.35 : 1.8;
        }

        // Particle Drift and Teleport FX with Aura Palette
        const drift =
          activeGesture === "stare"
            ? 3.2
            : activeGesture === "teleport"
              ? 4.5
              : isSpeaking
                ? 1.6
                : currentMood === "offline"
                  ? 0.25
                  : 1.0;

        for (let i = 0; i < rig.particleMeshes.length; i++) {
          const mesh = rig.particleMeshes[i];
          const data = mesh.userData;
          mesh.position.y += delta * data.speed * drift;
          mesh.position.x = data.baseX + Math.sin(breath + data.twinkle) * 0.18;
          mesh.position.z = data.baseZ + Math.cos(breath + data.twinkle) * 0.18;
          if (mesh.position.y > 4.2) mesh.position.y = 0.15;
          const size = (Math.sin(breath * 3 + data.twinkle) * 0.35 + 0.8) * (activeGesture === "stare" ? 1.5 : 1.0);
          mesh.scale.set(size, size, size);

          // Aura Color modulation
          if (currentAura === "cyan") {
            mesh.material.color.setHex(i % 2 === 0 ? 0x06b6d4 : 0x38bdf8);
          } else if (currentAura === "gold") {
            mesh.material.color.setHex(i % 2 === 0 ? 0xf59e0b : 0xfbbf24);
          } else if (currentAura === "rainbow") {
            const ph = ((now * 0.0003) + i * 0.02) % 1.0;
            mesh.material.color.setHSL(ph, 0.9, 0.65);
          } else {
            mesh.material.color.setHex([0xd946ef, 0xa855f7, 0xf5d0fe][i % 3]);
          }
        }

        renderer.render(rig.scene, rig.camera);
      };

      if (reduced) {
        breath = 0.8;
        rig.torso.position.y = 2.3 + Math.sin(breath) * 0.025;
        renderer.render(rig.scene, rig.camera);
      } else {
        frame = requestAnimationFrame(tick);
      }

      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame);
        unsubLipSync();
        observer.disconnect();
        visibility.disconnect();
        host.removeEventListener("pointermove", onPointer);
        host.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={hostRef}
        className={`h-full w-full cursor-grab active:cursor-grabbing transition-opacity duration-300 ${
          teleporting ? "opacity-15 blur-[2px] scale-95" : "opacity-100 scale-100"
        }`}
        aria-label="3D Interactive Enderman Rig - Drag to orbit, click to interact"
        onClick={() => {
          if (currentGesture === "idle") {
            triggerGesture("wave");
          }
        }}
      />

      {!ready ? (
        <div className="absolute inset-0">
          <EndermanFallback mood={mood} />
        </div>
      ) : null}

      {/* Teleport Flash Overlay */}
      {teleporting ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-fuchsia-600/30 backdrop-blur-sm animate-ping duration-500">
          <span className="text-[13px] font-mono tracking-[0.25em] text-fuchsia-200 uppercase font-semibold">
            [ PORTAL JUMP ]
          </span>
        </div>
      ) : null}

      {/* Interactive HUD Reticle on Hover */}
      {isHovered && ready ? (
        <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono tracking-widest text-[#d946ef] opacity-90 transition-opacity">
          <span className="flex items-center gap-1.5 bg-[#0a0614]/80 px-2 py-0.5 rounded border border-[#3b1d54]">
            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 animate-ping" />
            TARGET: ENDERMAN-MK4
          </span>
          <span className="bg-[#0a0614]/80 px-2 py-0.5 rounded border border-[#3b1d54]">
            {currentGesture !== "idle" ? `GESTURE: ${currentGesture.toUpperCase()}` : "DRAG TO ROTATE 3D"}
          </span>
        </div>
      ) : null}

      {/* Mouse Command Bar */}
      {showControls && interactive ? (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-1 border-t border-[#2d1b42] bg-[#07050e]/90 p-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGesture("wave");
            }}
            className={`rounded-lg px-2 py-1 text-[10.5px] font-mono tracking-wider transition-all ${
              currentGesture === "wave"
                ? "bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]"
                : "text-zinc-300 hover:bg-[#1a102c] hover:text-fuchsia-300"
            }`}
            title="Command: Friendly Wave"
          >
            ✋ Wave
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGesture("teleport");
            }}
            className={`rounded-lg px-2 py-1 text-[10.5px] font-mono tracking-wider transition-all ${
              currentGesture === "teleport"
                ? "bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]"
                : "text-zinc-300 hover:bg-[#1a102c] hover:text-fuchsia-300"
            }`}
            title="Command: Ender Teleport"
          >
            ⚡ Warp
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGesture("stare");
            }}
            className={`rounded-lg px-2 py-1 text-[10.5px] font-mono tracking-wider transition-all ${
              currentGesture === "stare"
                ? "bg-rose-600 text-white shadow-[0_0_12px_rgba(225,29,72,0.6)]"
                : "text-zinc-300 hover:bg-[#1a102c] hover:text-rose-300"
            }`}
            title="Command: Ender Stare & Aggro Jaw"
          >
            👁️ Stare
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGesture("point");
            }}
            className={`rounded-lg px-2 py-1 text-[10.5px] font-mono tracking-wider transition-all ${
              currentGesture === "point"
                ? "bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]"
                : "text-zinc-300 hover:bg-[#1a102c] hover:text-fuchsia-300"
            }`}
            title="Command: Point Telemetry"
          >
            👉 Point
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGesture("salute");
            }}
            className={`rounded-lg px-2 py-1 text-[10.5px] font-mono tracking-wider transition-all ${
              currentGesture === "salute"
                ? "bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]"
                : "text-zinc-300 hover:bg-[#1a102c] hover:text-fuchsia-300"
            }`}
            title="Command: Astronaut Salute"
          >
            🫡 Salute
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default memo(EndermanAvatar);

export function EndermanGlyph({ mood }: { mood: EndermanMood }) {
  const dim = mood === "offline";
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" role="img" aria-label="ORION Enderman Icon">
      <rect x="9" y="5" width="22" height="22" fill={dim ? "#16161d" : "#0e0e14"} />
      <rect x="13" y="15" width="6" height="2" fill={dim ? "#5b2b6b" : "#d946ef"} />
      <rect x="21" y="15" width="6" height="2" fill={dim ? "#5b2b6b" : "#d946ef"} />
      <rect x="14" y="14" width="2" height="1" fill="#f5d0fe" />
      <rect x="22" y="14" width="2" height="1" fill="#f5d0fe" />
      <rect x="14" y="27" width="4" height="8" fill={dim ? "#16161d" : "#0e0e14"} />
      <rect x="22" y="27" width="4" height="8" fill={dim ? "#16161d" : "#0e0e14"} />
    </svg>
  );
}

export function EndermanProfile() {
  const [profile, setProfile] = useState<{ name?: string; description?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(PROFILE_SRC)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!cancelled) setProfile(value);
      })
      .catch(() => {
        /* optional character metadata */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="readout block truncate text-[10.5px] tracking-[0.16em] text-[#a855f7] uppercase">
      {profile?.name || "ORION"} · MINECRAFT VOXEL RIG
    </span>
  );
}
