/**
 * STORMFORGE SKY-CITADEL: Master Tunable CONFIG
 */

window.STORMFORGE_CONFIG = {
  // Quality & Rendering
  quality: 'high', // 'low' | 'med' | 'high'
  dprMax: 2,
  fpsDropThreshold: 45,
  fpsDropDurationMs: 2000,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  // Active Character & Dragon Skin
  characterPreset: localStorage.getItem('sunday:character_preset') || 'enderman', // 'enderman' | 'skybolt'
  dragonSkin: localStorage.getItem('stormforge:dragon_skin') || 'enderDragon',    // 'enderDragon' | 'stormwyrm'

  // Characters
  heroEnabled: true,
  vaelEnabled: true,
  flickerEnabled: true,

  // Stormwyrm Vael
  vael: {
    segmentCount: 36,
    headWidth: 44,
    tailWidth: 5,
    minDurationMs: 1000,
    maxDurationMs: 1300,
    peakCoveragePercent: 0.45,
    screenShakePx: 3,
    rainStreakDurationMs: 600,
    stormDecayDurationMs: 8000
  },

  // Flicker Spirit
  flicker: {
    minIntervalMs: 8000,
    maxIntervalMs: 25000,
    stayMinMs: 2000,
    stayMaxMs: 6000,
    evasionRadiusPx: 70,
    teleportCollapseMs: 150,
    teleportExpandMs: 200,
    sparkCount: 12,
    teleportHeroChance: 1 / 15 // 1 in 15 chance
  },

  // Audio Bed (WebAudio)
  audio: {
    enabled: false, // Default off per spec
    masterVolume: 0.4,
    duckedVolume: 0.1,
    ambientWind: true,
    distantThunder: true,
    crystalChimes: true
  },

  // Power Meter
  powerMeter: {
    clickCharge: 5,
    keystrokeCharge: 2,
    decayRatePerSec: 1.5,
    burstDurationMs: 3000
  },

  // Cast Director Cooldowns
  director: {
    clickCooldownMs: 1500,
    idleAnticsTimeoutMs: 60000
  }
};
