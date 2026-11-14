import { useCallback, useEffect, useRef, useState } from "react";
import { EndermanGlyph, type EndermanGesture } from "@/components/EndermanAvatar";
import { sound } from "@/lib/sound-effects";

type Point = { x: number; y: number };

const GESTURES: EndermanGesture[] = ["wave", "point", "salute", "thinking", "nod", "stare", "teleport"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stagePoint(clientX: number, clientY: number): Point {
  const pad = 28;
  const size = 92;
  return {
    x: clamp(clientX - size / 2, pad, window.innerWidth - size - pad),
    y: clamp(clientY - size / 2, pad, window.innerHeight - size - pad),
  };
}

function attractionPoint(): Point {
  const edge = 36;
  const size = 92;
  const spots = [
    { x: edge, y: window.innerHeight * 0.34 },
    { x: window.innerWidth - size - edge, y: window.innerHeight * 0.22 },
    { x: window.innerWidth * 0.42, y: edge + 8 },
    { x: window.innerWidth - size - edge, y: window.innerHeight * 0.62 },
    { x: edge, y: window.innerHeight * 0.7 },
  ];
  const pick = spots[Math.floor(Math.random() * spots.length)];
  return stagePoint(pick.x + size / 2, pick.y + size / 2);
}

/**
 * Screen-space Enderman. He does not walk between places — he teleports,
 * the way the mob does, so the page has a moving point of attention.
 * Double-click empty space to summon him. Click him to cycle a gesture.
 * Drag him if you want him to stay.
 */
export default function OrionWanderer() {
  const [pos, setPos] = useState<Point>({ x: 24, y: 180 });
  const [burst, setBurst] = useState<Point | null>(null);
  const [gesture, setGesture] = useState<EndermanGesture>("idle");
  const [line, setLine] = useState("Double-click the page to summon me");
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const hold = useRef(0);

  const teleportTo = useCallback((next: Point, caption: string, playSound: boolean) => {
    setBurst(next);
    setPos(next);
    setGesture("teleport");
    setLine(caption);
    if (playSound) sound.playTeleport();
    window.setTimeout(() => setBurst(null), 700);
    window.setTimeout(() => setGesture("idle"), 900);
    window.dispatchEvent(new CustomEvent("orion:gesture", { detail: { gesture: "teleport" } }));
  }, []);

  useEffect(() => {
    setPos(attractionPoint());
  }, []);

  useEffect(() => {
    const onTeleport = (event: Event) => {
      const detail = (event as CustomEvent<{ x?: number; y?: number }>).detail;
      const next =
        typeof detail?.x === "number" && typeof detail?.y === "number"
          ? stagePoint(detail.x, detail.y)
          : attractionPoint();
      teleportTo(next, "Portal lock", false);
    };
    const onGesture = (event: Event) => {
      const name = (event as CustomEvent<{ gesture?: EndermanGesture }>).detail?.gesture;
      if (!name || name === "teleport") return;
      setGesture(name);
      setLine(name);
    };
    window.addEventListener("orion:teleport", onTeleport);
    window.addEventListener("orion:gesture", onGesture);
    return () => {
      window.removeEventListener("orion:teleport", onTeleport);
      window.removeEventListener("orion:gesture", onGesture);
    };
  }, [teleportTo]);

  useEffect(() => {
    const onDbl = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button, input, textarea, select, label, [data-orion-anchor]")) return;
      teleportTo(stagePoint(event.clientX, event.clientY), "Summoned to your cursor", true);
      hold.current = Date.now() + 20000;
    };
    window.addEventListener("dblclick", onDbl);
    return () => window.removeEventListener("dblclick", onDbl);
  }, [teleportTo]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden || drag.current || Date.now() < hold.current) return;
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      teleportTo(attractionPoint(), "Passing through", true);
    }, 16000);
    return () => window.clearInterval(id);
  }, [teleportTo]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      drag.current.moved = true;
      setPos({
        x: clamp(event.clientX - drag.current.dx, 8, window.innerWidth - 100),
        y: clamp(event.clientY - drag.current.dy, 8, window.innerHeight - 100),
      });
    };
    const up = () => {
      if (drag.current?.moved) {
        hold.current = Date.now() + 25000;
        suppressClick.current = true;
      }
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const cycleGesture = () => {
    const next = GESTURES[(GESTURES.indexOf(gesture) + 1) % GESTURES.length];
    setGesture(next);
    setLine(next === "teleport" ? "Warp" : next);
    window.dispatchEvent(new CustomEvent("orion:gesture", { detail: { gesture: next } }));
    if (next === "wave") sound.playGesture();
    else if (next === "stare") sound.playEnderStare();
    else if (next === "teleport") sound.playTeleport();
    else sound.playChirp();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-hidden="false">
      {burst ? (
        <span
          className="orion-portal pointer-events-none absolute h-24 w-24"
          style={{ left: burst.x - 4, top: burst.y - 8 }}
        />
      ) : null}
      <button
        type="button"
        data-orion-anchor=""
        className="pointer-events-auto absolute flex w-[92px] cursor-grab flex-col items-center active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y }}
        aria-label="ORION. Drag to move. Click to change gesture. Double-click the page to teleport him to the cursor."
        onPointerDown={(event) => {
          drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y, moved: false };
          (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          cycleGesture();
        }}
      >
        <span className="orion-float relative grid h-[78px] w-[78px] place-items-center">
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,#d946ef55,transparent_68%)] blur-md" />
          <span className="relative h-16 w-16 drop-shadow-[0_10px_18px_rgba(217,70,239,0.45)]">
            <EndermanGlyph mood={gesture === "stare" ? "speaking" : "idle"} />
          </span>
        </span>
        <span className="mt-1 max-w-[9rem] truncate rounded-full border border-[#f0b64a55] bg-[#070b14ee] px-2 py-0.5 text-[9px] font-mono tracking-[0.14em] text-[#f0b64a] uppercase">
          {line}
        </span>
      </button>
    </div>
  );
}
