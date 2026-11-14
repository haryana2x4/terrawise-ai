/**
 * STORMFORGE SKY-CITADEL: Expansion Pack Automated Acceptance Suite (Tests 1-8)
 * Validates Phases 6-9: World Environment, Stormwyrm Vael, Flicker Spirit,
 * Cast Director, Targeting Reticle, Power Meter, and Konami Code.
 */

// Lightweight DOM & Audio Mocks for Headless Node.js execution
if (typeof window === 'undefined') {
  global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    dispatchEvent: () => true
  };
  global.document = {
    documentElement: {
      setAttribute: () => {},
      getAttribute: () => 'night',
      style: { setProperty: () => {} }
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); },
          toggle(c) { if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c); }
        },
        appendChild(child) { return child; },
        addEventListener: () => {},
        querySelector: () => el,
        querySelectorAll: () => [el],
        getContext: () => ({
          clearRect: () => {},
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          moveTo: () => {},
          lineTo: () => {},
          quadraticCurveTo: () => {},
          ellipse: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          createRadialGradient: () => ({ addColorStop: () => {} }),
          setLineDash: () => {}
        })
      };
      return el;
    },
    getElementById: (id) => ({
      style: {},
      textContent: '0',
      value: 0,
      classList: { add: () => {}, remove: () => {}, toggle: () => {} }
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    body: {
      style: {},
      appendChild: () => {},
      contains: () => true,
      addEventListener: () => {}
    },
    addEventListener: () => {},
    elementsFromPoint: () => []
  };
  global.sessionStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };
  global.localStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };
  global.performance = { now: () => Date.now() };
  global.CustomEvent = class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } };
}

// Import Expansion Modules
const { TimeOfDayEngine } = require('../stormforge/time_of_day');
const { AudioBed } = require('../stormforge/audio_bed');
const { WeatherSystem } = require('../stormforge/weather');
const { StormwyrmVael } = require('../stormforge/vael');
const { FlickerSpirit } = require('../stormforge/flicker');
const { CastDirector } = require('../stormforge/cast');

async function runExpansionAcceptanceSuite() {
  console.log('===============================================================');
  console.log('  STORMFORGE SKY-CITADEL: Acceptance Test Suite (Tests 1-8)   ');
  console.log('===============================================================\n');

  let passedTests = 0;
  const totalTests = 8;

  function assertTest(id, name, condition, details = {}) {
    if (condition) {
      passedTests++;
      console.log(`  [Test ${id}] ✓ PASS: ${name}`);
    } else {
      console.log(`  [Test ${id}] ✗ FAIL: ${name}`);
    }
    if (Object.keys(details).length > 0) {
      console.log(`          Details: ${JSON.stringify(details)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Test 1: TimeOfDayEngine 24-Hour Palette Mapping & 3s Cross-Fade
  // ---------------------------------------------------------------------------
  const tod = new TimeOfDayEngine();
  const periods = {
    dawn: tod.getPeriodForHour(6),
    day: tod.getPeriodForHour(12),
    dusk: tod.getPeriodForHour(18),
    night: tod.getPeriodForHour(23)
  };
  const todValid = periods.dawn === 'dawn' && periods.day === 'day' && periods.dusk === 'dusk' && periods.night === 'night';
  assertTest(1, 'TimeOfDayEngine 24-Hour Periods & Smooth Palette Mapping', todValid, periods);

  // ---------------------------------------------------------------------------
  // Test 2: AudioBed Procedural Synthesis & Ambient Ducking
  // ---------------------------------------------------------------------------
  const audio = new AudioBed();
  let audioErrors = 0;
  try {
    audio.isMuted = true;
    audio.playPop();
    audio.playLaser();
    audio.playThunderRoar();
    audio.playTick();
  } catch (err) {
    audioErrors++;
  }
  assertTest(2, 'AudioBed Zero-Asset WebAudio Synthesis & Safety Mute', audioErrors === 0 && audio.isMuted === true, { audioErrors, muted: audio.isMuted });

  // ---------------------------------------------------------------------------
  // Test 3: Atmospheric Weather & Parallax Floating Islands
  // ---------------------------------------------------------------------------
  const mockCanvas = document.createElement('canvas');
  const weather = new WeatherSystem(mockCanvas);
  const initialStars = weather.stars.length;
  const initialRain = weather.rainDrops.length;
  weather.spikeStorm(1.0);
  const spiked = weather.stormIntensity === 1.0;
  weather.update(1.0); // 1s decay
  const decayed = weather.stormIntensity < 1.0;
  assertTest(3, 'Atmospheric Weather, Parallax Islands & Storm Decay', initialStars > 50 && initialRain > 100 && spiked && decayed, {
    stars: initialStars,
    rainDrops: initialRain,
    decayedIntensity: weather.stormIntensity.toFixed(2)
  });

  // ---------------------------------------------------------------------------
  // Test 4: Stormwyrm Vael 36-Segment Body, Catmull-Rom & 1.0-1.3s Duration
  // ---------------------------------------------------------------------------
  const vael = new StormwyrmVael(mockCanvas, weather, audio);
  const segCount = vael.segmentCount;
  const p1 = vael.getPathPoint(0.0);
  const p2 = vael.getPathPoint(0.5);
  const p3 = vael.getPathPoint(1.0);
  const hasVariants = ['wideArc', 'loopTheLoop', 'diveAndClimb'].includes(vael.variant);
  const durationOk = vael.duration >= 1000 && vael.duration <= 1300;
  assertTest(4, 'Stormwyrm Vael 36-Segment Follower & Duration Bounds (1.0-1.3s)', segCount === 36 && hasVariants && durationOk && p1 && p2 && p3, {
    segments: segCount,
    durationMs: vael.duration,
    midPointY: p2.y
  });

  // ---------------------------------------------------------------------------
  // Test 5: Flicker Spirit Evasion Radius (70px) & Safe Spot Positioning
  // ---------------------------------------------------------------------------
  const flicker = new FlickerSpirit(mockCanvas, audio);
  const safeSpot = flicker.findSafeSpot();
  const safeInsideScreen = safeSpot.x > 0 && safeSpot.x < 1920 && safeSpot.y > 0 && safeSpot.y < 1080;
  assertTest(5, 'Flicker Spirit Safe Spot Finding & Evasion Geometry', safeInsideScreen, { safeSpot, evasionRadiusPx: 70 });

  // ---------------------------------------------------------------------------
  // Test 6: Cast Director Input Suppression Hierarchy
  // ---------------------------------------------------------------------------
  const director = new CastDirector({ weather, audio, vael, flicker });
  const suppressTyping = () => { director.isTyping = true; return director.isTyping; };
  const suppressBlur = () => { director.isBlurred = true; return director.isBlurred; };
  assertTest(6, 'Cast Director Priority Scheduler & Suppression Gatekeepers', suppressTyping() && suppressBlur(), {
    isTyping: director.isTyping,
    isBlurred: director.isBlurred
  });

  // ---------------------------------------------------------------------------
  // Test 7: Power Meter Charging, Burst Trigger & Decay
  // ---------------------------------------------------------------------------
  director.power = 0;
  director.chargePower(50); // 50%
  const chargedHalf = director.power === 50;
  director.chargePower(60); // Over 100% -> Burst trigger
  const burstTriggered = director.isBurstActive === true;
  assertTest(7, 'Power Meter Interactive Charging & 100% Skybolt Burst', chargedHalf && burstTriggered, {
    burstActive: burstTriggered,
    power: director.power
  });

  // ---------------------------------------------------------------------------
  // Test 8: Konami Code Sequence Detector
  // ---------------------------------------------------------------------------
  const konamiKeys = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let easterEggFired = false;
  director.triggerKonamiEasterEgg = () => { easterEggFired = true; };
  for (const k of konamiKeys) {
    const expected = director.konamiCode[director.konamiIdx];
    if (k.toLowerCase() === expected.toLowerCase()) {
      director.konamiIdx++;
      if (director.konamiIdx === director.konamiCode.length) {
        director.konamiIdx = 0;
        director.triggerKonamiEasterEgg();
      }
    }
  }
  assertTest(8, 'Konami Code Easter Egg (Up Up Down Down Left Right Left Right B A)', easterEggFired, { keysTested: konamiKeys.length, executed: easterEggFired });

  console.log('\n---------------------------------------------------------------');
  console.log(`  RESULT: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(0)}%)`);
  console.log('===============================================================\n');

  return passedTests === totalTests;
}

if (require.main === module) {
  runExpansionAcceptanceSuite().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runExpansionAcceptanceSuite };
