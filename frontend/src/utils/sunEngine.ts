/**
 * TERRAWISE AI - Astronomical Sun Engine
 * Calculates solar position (altitude & azimuth) and time-of-day phases for Nashik / Ahilya Nagar
 * Coordinates: 19.9975° N, 73.7898° E (UTC+5:30)
 */

export type SunPhase = "night" | "dawn" | "morning" | "noon" | "golden_hour" | "dusk";

export interface SunThemeState {
  phase: SunPhase;
  phaseLabel: { mr: string; hi: string; en: string };
  greeting: { mr: string; hi: string; en: string };
  altitudeDeg: number;
  azimuthDeg: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  sunGlowColor: string;
  skyTintOverlay: string;
  cardBgClass: string;
  accentColor: string;
}

export function computeSunTheme(customHour?: number): SunThemeState {
  const now = new Date();
  const currentHour = customHour !== undefined ? customHour : now.getHours() + now.getMinutes() / 60.0;

  let phase: SunPhase = "noon";
  let alt = 45;
  let az = 180;

  if (currentHour >= 5.25 && currentHour < 6.75) {
    phase = "dawn";
    alt = (currentHour - 5.25) * 6.0; // 0 to 9 deg
    az = 85 + (currentHour - 5.25) * 15;
  } else if (currentHour >= 6.75 && currentHour < 11.5) {
    phase = "morning";
    alt = 10 + (currentHour - 6.75) * 10;
    az = 105 + (currentHour - 6.75) * 14;
  } else if (currentHour >= 11.5 && currentHour < 16.0) {
    phase = "noon";
    alt = 65;
    az = 170 + (currentHour - 11.5) * 15;
  } else if (currentHour >= 16.0 && currentHour < 18.5) {
    phase = "golden_hour";
    alt = Math.max(3, 30 - (currentHour - 16.0) * 11);
    az = 240 + (currentHour - 16.0) * 15;
  } else if (currentHour >= 18.5 && currentHour < 20.25) {
    phase = "dusk";
    alt = Math.max(-6, 3 - (currentHour - 18.5) * 5);
    az = 275 + (currentHour - 18.5) * 12;
  } else {
    phase = "night";
    alt = -35;
    az = 0;
  }

  // Calculate dynamic shadow direction opposite to sun azimuth
  const rad = (az * Math.PI) / 180.0;
  const shadowX = Math.round(-Math.sin(rad) * 14);
  const shadowY = Math.max(6, Math.round(Math.cos(rad) * 10) + 12);
  const shadowBlur = phase === "golden_hour" ? 36 : 24;

  const phaseConfigs: Record<SunPhase, {
    label: { mr: string; hi: string; en: string };
    greeting: { mr: string; hi: string; en: string };
    glow: string;
    skyTint: string;
    cardBg: string;
    accent: string;
  }> = {
    dawn: {
      label: { mr: "पहाट (Dawn)", hi: "भोर (Dawn)", en: "Misty Dawn" },
      greeting: { mr: "शुभ प्रभात", hi: "शुभ प्रभात", en: "Good Morning" },
      glow: "rgba(255, 183, 77, 0.4)",
      skyTint: "linear-gradient(180deg, rgba(255, 171, 145, 0.25) 0%, rgba(255, 224, 178, 0.15) 100%)",
      cardBg: "rgba(255, 250, 240, 0.82)",
      accent: "#d48b38"
    },
    morning: {
      label: { mr: "सकाळ (Morning)", hi: "सुबह (Morning)", en: "Morning Sun" },
      greeting: { mr: "शुभ सकाळ", hi: "शुभ प्रभात", en: "Good Morning" },
      glow: "rgba(255, 238, 140, 0.35)",
      skyTint: "linear-gradient(180deg, rgba(179, 229, 252, 0.2) 0%, rgba(220, 237, 200, 0.1) 100%)",
      cardBg: "rgba(255, 255, 255, 0.85)",
      accent: "#2d6a4f"
    },
    noon: {
      label: { mr: "दुपार (Midday)", hi: "दोपहर (Midday)", en: "Bright Midday" },
      greeting: { mr: "शुभ दुपार", hi: "शुभ दोपहर", en: "Good Afternoon" },
      glow: "rgba(255, 255, 255, 0.4)",
      skyTint: "linear-gradient(180deg, rgba(129, 212, 250, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%)",
      cardBg: "rgba(255, 255, 255, 0.88)",
      accent: "#1b4332"
    },
    golden_hour: {
      label: { mr: "सुवर्ण संध्याकाळ (Golden Hour)", hi: "सुनहरी शाम (Golden Hour)", en: "Golden Hour" },
      greeting: { mr: "शुभ संध्याकाळ", hi: "शुभ संध्या", en: "Good Evening" },
      glow: "rgba(242, 169, 59, 0.55)",
      skyTint: "linear-gradient(180deg, rgba(255, 152, 0, 0.3) 0%, rgba(255, 214, 153, 0.2) 100%)",
      cardBg: "rgba(254, 250, 238, 0.86)",
      accent: "#c67d1d"
    },
    dusk: {
      label: { mr: "सायंकाळ (Dusk)", hi: "गोधूलि (Dusk)", en: "Warm Dusk" },
      greeting: { mr: "शुभ संध्याकाळ", hi: "शुभ संध्या", en: "Good Evening" },
      glow: "rgba(216, 67, 21, 0.4)",
      skyTint: "linear-gradient(180deg, rgba(74, 20, 140, 0.3) 0%, rgba(230, 81, 0, 0.25) 100%)",
      cardBg: "rgba(250, 245, 240, 0.85)",
      accent: "#a73a1e"
    },
    night: {
      label: { mr: "रात्र (Night)", hi: "रात (Night)", en: "Quiet Night" },
      greeting: { mr: "शुभ रात्री", hi: "शुभ रात्रि", en: "Good Night" },
      glow: "rgba(92, 107, 192, 0.35)",
      skyTint: "linear-gradient(180deg, rgba(13, 27, 42, 0.6) 0%, rgba(20, 32, 60, 0.45) 100%)",
      cardBg: "rgba(26, 36, 56, 0.88)",
      accent: "#52b788"
    }
  };

  const c = phaseConfigs[phase];

  return {
    phase,
    phaseLabel: c.label,
    greeting: c.greeting,
    altitudeDeg: Math.round(alt),
    azimuthDeg: Math.round(az),
    shadowOffsetX: shadowX,
    shadowOffsetY: shadowY,
    shadowBlur,
    sunGlowColor: c.glow,
    skyTintOverlay: c.skyTint,
    cardBgClass: c.cardBg,
    accentColor: c.accent
  };
}
