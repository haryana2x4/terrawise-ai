import { useEffect, useRef, useState } from "react";

type SceneProps = { className?: string };

export default function OrbitalScene({ className = "" }: SceneProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let rafId = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: x * 14, y: y * -10 });
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`pointer-events-none absolute inset-0 ${className}`}>
      <svg
        viewBox="0 0 600 600"
        className="h-full w-full"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
          transition: "transform 400ms cubic-bezier(0.22,0.8,0.24,1)",
        }}
      >
        <defs>
          <radialGradient id="be-planet" cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#1d3a6b" />
            <stop offset="42%" stopColor="#0e1f3d" />
            <stop offset="100%" stopColor="#04070f" />
          </radialGradient>
          <radialGradient id="be-atmo" cx="50%" cy="50%" r="50%">
            <stop offset="62%" stopColor="#ff9d4d" stopOpacity="0" />
            <stop offset="86%" stopColor="#ff9d4d" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff9d4d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="be-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#cfd9e8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#f0b64a" stopOpacity="0.2" />
          </linearGradient>
          <filter id="be-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <circle cx="300" cy="300" r="150" fill="url(#be-atmo)" className="atmo" />
        <circle cx="300" cy="300" r="150" fill="url(#be-planet)" />
        <ellipse
          cx="300"
          cy="300"
          rx="150"
          ry="150"
          fill="none"
          stroke="#aebfd6"
          strokeOpacity="0.25"
          strokeWidth="1.2"
          className="ring-spin"
        />

        <g opacity="0.85">
          <ellipse
            cx="300"
            cy="300"
            rx="238"
            ry="86"
            fill="none"
            stroke="url(#be-ring)"
            strokeWidth="1.4"
            transform="rotate(-18 300 300)"
            className="ring-spin-slow"
          />
          <ellipse
            cx="300"
            cy="300"
            rx="196"
            ry="62"
            fill="none"
            stroke="#7d94b5"
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="3 9"
            transform="rotate(24 300 300)"
            className="ring-spin-reverse"
          />
        </g>

        <circle r="4.5" fill="#f2f5fb">
          <animateMotion
            dur="17s"
            repeatCount="indefinite"
            rotate="auto"
            path="M 62,300 a 238,86 -18 1,0 476,0 a 238,86 -18 1,0 -476,0"
          />
          <animate
            attributeName="opacity"
            values="0.25;1;0.25"
            dur="3.4s"
            repeatCount="indefinite"
          />
        </circle>

        <circle r="3" fill="#9fb0c9">
          <animateMotion
            dur="11s"
            repeatCount="indefinite"
            rotate="auto"
            path="M 104,300 a 196,62 24 1,0 392,0 a 196,62 24 1,0 -392,0"
          />
        </circle>

        <circle r="2" fill="#ffd08a" opacity="0.9">
          <animateMotion
            dur="26s"
            repeatCount="indefinite"
            path="M 300,150 a 150,150 0 1,1 -0.1,0"
          />
        </circle>

        <g className="scan-sweep">
          <path d="M 300 300 L 300 150 A 150 150 0 0 1 424 225 Z" fill="#f0b64a" opacity="0.06" />
        </g>

        <g filter="url(#be-blur)" opacity="0.55">
          <circle cx="196" cy="214" r="26" fill="#f0b64a" opacity="0.28" />
          <circle cx="404" cy="392" r="18" fill="#e8933f" opacity="0.32" />
        </g>
      </svg>
    </div>
  );
}
