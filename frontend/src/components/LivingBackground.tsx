import React from "react";
import { SunPhase, SunThemeState } from "../utils/sunEngine";
import { AmbientWeatherCanvas } from "./AmbientWeatherCanvas";

interface LivingBackgroundProps {
  variant: "hero" | "workspace";
  sunTheme: SunThemeState;
  hasRain?: boolean;
  isLiteTier: boolean;
}

function getHeroImage(phase: SunPhase): string {
  switch (phase) {
    case "dawn":
      return "/img/hero/dawn_onion_mist_desktop_1600.webp";
    case "morning":
      return "/img/hero/morning_vineyard_niphad_desktop_1600.webp";
    case "noon":
      return "/img/hero/noon_lush_crops_desktop_1600.webp";
    case "golden_hour":
      return "/img/hero/golden_hour_fields_desktop_1600.webp";
    case "dusk":
      return "/img/hero/dusk_horizon_glow_desktop_1600.webp";
    case "night":
    default:
      return "/img/hero/night_sky_field_desktop_1600.webp";
  }
}

function getWorkspaceGradient(phase: SunPhase): string {
  switch (phase) {
    case "dawn":
      return "linear-gradient(155deg, #fffbeb 0%, #fef3c7 24%, #ecfdf5 62%, #f5f5f4 100%)";
    case "morning":
      return "linear-gradient(155deg, #f0fdf4 0%, #dcfce7 28%, #fefce8 64%, #f5f5f4 100%)";
    case "noon":
      return "linear-gradient(155deg, #f0f9ff 0%, #ecfdf5 35%, #f5f5f4 75%, #e7e5e4 100%)";
    case "golden_hour":
      return "linear-gradient(155deg, #fffbeb 0%, #fde68a40 30%, #ecfdf5 68%, #f5f5f4 100%)";
    case "dusk":
      return "linear-gradient(155deg, #fef2f2 0%, #ffedd5 26%, #ecfdf5 64%, #f5f5f4 100%)";
    case "night":
    default:
      return "linear-gradient(155deg, #f1f5f9 0%, #ecfdf5 36%, #f5f5f4 75%, #e7e5e4 100%)";
  }
}

export const LivingBackground: React.FC<LivingBackgroundProps> = ({
  variant,
  sunTheme,
  hasRain = false,
  isLiteTier
}) => {
  // Map astronomical solar azimuth (80..290) and altitude (-35..65) to viewport coordinates
  const sunXPercent = Math.min(88, Math.max(12, ((sunTheme.azimuthDeg - 70) / 220) * 76 + 12));
  const sunYPercent =
    sunTheme.phase === "night"
      ? 14
      : Math.min(48, Math.max(8, 46 - (Math.max(0, sunTheme.altitudeDeg) / 65) * 36));

  if (variant === "hero") {
    const heroSrc = getHeroImage(sunTheme.phase);
    return (
      <>
        {/* 1. Agricultural Field Horizon Photography */}
        <div
          className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000 ease-out"
          style={{
            backgroundImage: `url(${heroSrc})`,
            filter: isLiteTier ? "none" : "brightness(0.95) saturate(1.08)"
          }}
          aria-hidden="true"
        />

        {/* 2. Astronomical Sky Tint */}
        <div
          className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000"
          style={{
            background: sunTheme.skyTintOverlay,
            opacity: 0.88
          }}
          aria-hidden="true"
        />

        {/* 3. Volumetric Solar/Lunar Halo positioned by astronomical coordinates */}
        {!isLiteTier && (
          <div
            className="fixed inset-0 z-0 pointer-events-none transition-all duration-1000"
            style={{
              background: `radial-gradient(circle 420px at ${sunXPercent}% ${sunYPercent}%, ${sunTheme.sunGlowColor} 0%, rgba(255,255,255,0) 70%)`
            }}
            aria-hidden="true"
          />
        )}

        {/* 4. Subtle Cadastral Topographic Contour Overlay + Bottom Contrast Scrim */}
        <div
          className="fixed inset-0 z-0 pointer-events-none kshetra-topo-dark opacity-40"
          aria-hidden="true"
        />
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(6,24,16,0.42) 100%)"
          }}
          aria-hidden="true"
        />

        {/* 5. Interactive Atmospheric Particle Layer */}
        <AmbientWeatherCanvas
          phase={sunTheme.phase}
          hasRain={hasRain}
          isLiteTier={isLiteTier}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Base Time-of-Day Workspace Gradient */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{ background: getWorkspaceGradient(sunTheme.phase) }}
      />

      {/* Precision Topographic Land Survey Contours */}
      <div className="absolute inset-0 kshetra-topo-light opacity-90" />

      {/* Gentle Ambient Botanical & Solar Blooms */}
      {!isLiteTier && (
        <>
          <div
            className="absolute -top-32 -right-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-45"
            style={{
              background: `radial-gradient(circle, ${sunTheme.sunGlowColor} 0%, transparent 72%)`
            }}
          />
          <div
            className="absolute -bottom-36 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-35"
            style={{
              background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 72%)"
            }}
          />
        </>
      )}
    </div>
  );
};
