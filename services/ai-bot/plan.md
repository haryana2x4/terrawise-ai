# STORMFORGE SKY-CITADEL: EXPANSION PACK (Phases 6-9)
**Project**: SUNDAY v2: SovereignDev x Captain Skybolt  
**Unifying Universe**: *Stormforge Sky-Citadel*  
**Cast**: Captain Skybolt (Teal & Gold), Stormwyrm Vael (Pearl & Electric Cyan), Flicker (Static Fox Spirit, Gold & Blue)

---

## Architecture & File Structure for Expansion

```
SUNDAY/
├── index.html                   # Main Studio (Upgraded with Sky-Citadel canvas, reticle, power meter)
├── project.html                 # Showcase Page (Upgraded with shared cast, transitions, and weather)
├── majestic.css                 # Upgraded with rune-line borders, crystal glints, time-of-day styles
├── stormforge/
│   ├── config.js                # Master tunable CONFIG (cooldowns, spawn rates, thresholds)
│   ├── audio_bed.js             # WebAudio procedural sound bed (wind, thunder, chimes, SFX)
│   ├── time_of_day.js           # 24-hr clock palette engine (Dawn, Day, Dusk, Night) with 3s cross-fade
│   ├── vael.js                  # Stormwyrm procedural 36-segment Catmull-Rom canvas transition
│   ├── flicker.js               # Teleporting fox static spirit with halo animation & evasion
│   ├── cast.js                  # Master Cast Director & spectacle scheduler
│   ├── reticle.js               # Gold corner-bracket targeting system & sound
│   └── weather.js               # Parallax floating islands, storm rain, lightning & particle pool
└── tests/
    └── expansion_suite.js       # Acceptance tests 1-8 automated validation
```

---

## Phase Breakdown

### Phase 6: World Environment, Time-of-Day & WebAudio Bed
- Create `stormforge/config.js` with full tunables.
- Create `stormforge/time_of_day.js` reading local system clock, setting CSS variables, and cross-fading over 3s.
- Create `stormforge/audio_bed.js` procedural WebAudio synthesis for wind, thunder, laser, pop, roar, chimes.
- Create `stormforge/weather.js` 3-depth parallax floating islands with crystal spires, glowing rune bridges, and skyline.

### Phase 7: Stormwyrm "Vael" Procedural Transition
- Create `stormforge/vael.js` with 36-segment follow-the-leader spline body, width taper 44px -> 5px, ripple wings, scale shimmer, electric arcs, and cloud wisps.
- 3 Trajectory generators: wide arc, loop-the-loop, dive-and-climb with 1.5 sine wobble and mid-pass camera scale 1.0x -> 1.8x.
- Navigation interception for Home <-> Project with teal-white lightning flash at ~45% peak coverage.
- Secondary effects: screen shake (3px), wind gust nudging cards, rain streaks (600ms), skybolt eye-shield gesture.
- SPA delay & MPA `sessionStorage['hero:transition']` handling.

### Phase 8: "Flicker" Spirit & Cast Director
- Create `stormforge/flicker.js` glowing static fox spirit with ringed tail and contracting halo ring (150ms) + 12 sparks.
- Smart position finder using `document.elementsFromPoint` to never obscure interactive elements.
- Evasion logic (70px cursor distance), click counter incrementing sightings.
- Hero interplay: Skybolt laser miss gag, 1-in-15 teleport swap gag.
- Create `stormforge/cast.js` priority scheduler enforcing spectacles and input suppressions.

### Phase 9: Extra Features, Polish & Acceptance Tests
- Gold targeting reticle on hover with soft tick.
- Power meter (bottom-left) filling on clicks/keystrokes, triggering "Skybolt Burst".
- Idle antics (60s timer): card edge sitting, scroll reading, yawning.
- Konami code listener (`↑ ↑ ↓ ↓ ← → ← → B A`) riding Vael with fireworks!
- Floating Cast Panel (gear icon) with toggles, quality settings, sightings counter.
- Automated acceptance test suite (`tests/expansion_suite.js`).

---

## Phase 6-9 Verification & Delivery Status

### 1. Verification Test Results
- **Acceptance Tests 1-8 (`tests/expansion_suite.js`)**: 8/8 Passed (100%)
  - Test 1: TimeOfDayEngine 24-Hour Periods & Smooth Palette Mapping (Dawn, Day, Dusk, Night)
  - Test 2: AudioBed Zero-Asset WebAudio Synthesis & Safety Mute
  - Test 3: Atmospheric Weather, Parallax Islands (3 depths) & Storm Decay (~8s)
  - Test 4: Stormwyrm Vael 36-Segment Spline, Scale Shimmer & Duration Bounds (1,150ms)
  - Test 5: Flicker Spirit Safe Spot Collision & 70px Evasion Geometry
  - Test 6: Cast Director Priority Hierarchy & Input Suppression Gatekeepers
  - Test 7: Power Meter Interactive Charging & 100% Skybolt Burst
  - Test 8: Konami Code Sequence Detector (`Up Up Down Down Left Right Left Right B A`)
- **Core SovereignDev Suite (`tests/eval_suite.js`)**: 8/8 Passed (100%) in 4,969ms

### 2. Tunable CONFIG Reference Table (`stormforge/config.js`)
| Configuration Key | Value | Description |
| :--- | :--- | :--- |
| `quality` | `'high'` | Options: `'low'`, `'med'`, `'high'` with auto-fallback on FPS < 45 |
| `dprMax` | `2` | Device pixel ratio ceiling for rendering performance |
| `reducedMotion` | `false` | Detected via `(prefers-reduced-motion: reduce)` |
| `vael.segmentCount` | `36` | Catmull-Rom spline follower segments |
| `vael.headWidth` / `tailWidth` | `44px` / `5px` | Sinuous body width taper |
| `vael.duration` | `1150ms` | Bounded strictly between 1,000ms and 1,300ms |
| `vael.peakCoveragePercent` | `0.45` | Timing of lightning flash & content swap (~45%) |
| `flicker.evasionRadiusPx` | `70px` | Distance at which Flicker emergency-teleports |
| `flicker.teleportHeroChance`| `1/15` | Chance of Flicker/Skybolt position swap gag |
| `powerMeter.clickCharge` | `5%` | Charge per user click |
| `powerMeter.keystrokeCharge`| `2%` | Charge per keystroke |
| `powerMeter.decayRatePerSec`| `1.5%` | Charge decay rate per second |
| `director.clickCooldownMs` | `1500ms` | Minimum silence time after user clicks |
| `director.idleAnticsTimeout`| `60000ms` | Idle antics trigger delay |

### 3. Visual Verification Artifacts
- **Home Studio**: `screenshot_expansion_home.png`
- **Project Showcase**: `screenshot_expansion_project.png`
- **Stormwyrm Vael Mid-Flight**: `screenshot_vael_flight.png`

