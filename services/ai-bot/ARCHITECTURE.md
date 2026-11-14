# SUNDAY v2: ARCHITECTURE & SYSTEM AUDIT
**Project**: SUNDAY — The First AI Companion with a Body (Offline-First Voxel Desktop Assistant)  
**Host Hardware**: 13th Gen Intel Core i7-13620H (10 Cores, 16 Threads) | NVIDIA GeForce RTX 3050 Laptop GPU (6 GB VRAM) | 16 GB DDR5 RAM  
**Workspace**: `C:\Users\Rocky\.gemini\antigravity\scratch\SUNDAY`  
**Status**: Phase 0 Complete — Audit & Technical Blueprint

---

## 1. System & Environment Audit

### 1.1 Host Environment
| Component | Detected Specification | Evaluation & Hackathon Suitability |
| :--- | :--- | :--- |
| **CPU** | Intel Core i7-13620H (10C / 16T) | **Tier-1**: Exceptional multi-threaded compute for local speech recognition, audio processing, and background agent loops. |
| **GPU / VRAM** | NVIDIA RTX 3050 Laptop (6 GB VRAM) | **Optimal**: 6 GB VRAM comfortably houses a 3B/4B quantized model (~2.2 GB VRAM) + Whisper Small/Base (~0.8 GB VRAM) with zero swap overhead. |
| **System RAM** | 16 GB DDR5 (Visible: 16.47 GB, Free: ~6.8 GB) | **Passed**: Sufficient headroom for Electron/Node desktop shell + Python backend (< 1 GB idle target). |
| **Node.js** | `v26.13.0` | **Modern**: Full native support for ES modules, WebGL 2, WebSockets, Web Audio API, and local IPC. |
| **NPM** | `11.20.0` | **Passed**: Ready for instant dependency resolution. |
| **Python** | Missing in current PATH (`WindowsApps` redirect) | **Action Required**: Provide both standard Python launcher instructions and a zero-dependency standalone Node.js fallback server so the demo **never** fails. |
| **Ollama** | Not installed in standard PATH | **Action Required**: Provide automated setup script + instant scripted Hero Demo Mode fallback. |

---

## 2. Codebase & Scaffolding Status

The directory `C:\Users\Rocky\.gemini\antigravity\scratch\SUNDAY` is newly provisioned.  
- `.agents/rules/sunday.md` has been created with PART 0 Standing Rules.
- Existing legacy assets from previous projects have been audited: zero conflicting files exist in this workspace.

### Target Directory Layout
```
SUNDAY/
├── .agents/
│   └── rules/
│       └── sunday.md                  # Part 0 Standing Rules
├── ARCHITECTURE.md                    # System blueprint & Phase 0 audit (this file)
├── BENCHMARKS.md                      # Latency, FPS, and resource benchmarks
├── package.json                       # Electron, Three.js, WebSocket dependencies
├── server.js                          # High-performance local bridge & event bus (port 8765)
├── index.html                         # World-class modern AI Web App & Studio shell
├── app.css                            # Modern glassmorphism, glowing HUD, CSS design system
├── core/
│   ├── event_bus.js                   # Unified state machine (sleeping -> talking)
│   ├── emotion.js                     # Hidden tag parsing (emotion + gesture extractor)
│   ├── agent.js                       # Agent prompt, personality hot-swapping & LLM client
│   ├── memory.js                      # Persistent preferences & fact storage (SQLite/JSON)
│   ├── voice.js                       # Offline STT & TTS audio pipeline
│   └── tools.js                       # Private Folder Q&A (RAG), Code Runner, Voice utilities
├── ui/
│   ├── avatar/
│   │   ├── voxel_rig.js               # 3D Minecraft humanoid rig (headset, hoodie, hair)
│   │   ├── animation_library.js       # 20+ keyframe animations & 150-250ms blending
│   │   └── lip_sync.js                # Viseme / audio amplitude mouth driver
│   ├── studio/
│   │   ├── studio_controller.js       # Timeline scrubbing, slider tuning, clip exporter
│   │   └── forge.js                   # Character Forge: 64x64 texture generator & painter
│   └── telemetry/
│       └── hud.js                     # OFFLINE ✓ badge, RAM, CPU, VRAM, tokens/sec
├── assets/
│   ├── skins/                         # Default Sunday skin, hacker skin, chill mentor skin
│   └── sfx/                           # Subtle UI chimes & state transition audio
├── scripts/
│   ├── setup.bat                      # One-click installation script
│   ├── demo.bat                       # Pre-warmed 90-second Hero Demo mode
│   └── run.bat                        # Standard application launch
└── tests/
    └── smoke_test.js                  # Automated headless validation test
```

---

## 3. UI/UX Architectural Blueprint: World-Class AI Interface

Per explicit design directives, the SUNDAY interface is engineered to compete with top-tier AI applications (Claude, Linear, ElevenLabs, OpenAI):

1. **Aesthetic & Theme System**:
   - **Deep Obsidian Dark Canvas**: Ultra-refined palette (`#08090c`, `#0e1117`, `#161b22`) with subtle specular border gradients.
   - **Reactive Ambient Glow**: Real-time atmospheric backdrop lighting that harmonizes with the 3D character's emotional state:
     - *Idle/Awake*: Soft Emerald (`#10b98122`)
     - *Listening*: Electric Blue (`#3b82f633`)
     - *Thinking*: Royal Amethyst (`#8b5cf633`)
     - *Speaking*: Radiant Rose (`#ec489933`)
     - *Working*: Golden Amber (`#f59e0b33`)
     - *Error*: Crimson Flare (`#ef444433`)
   - **Glassmorphism & Micro-Interactions**: Smooth 24px backdrop-blur panels, tactile mechanical buttons, and glowing indicators.

2. **3D Voxel Studio & Avatar Canvas**:
   - **Three.js WebGL Engine**: 60 FPS performance using optimized box geometry hierarchies, soft directional shadows, studio key-lighting, and ambient occlusion.
   - **Procedural Minecraft Voxel Rig**: Canonical Sunday character (messy brown hair, green hoodie with "S" crest, audio headset, animated eyes and mouth visemes).
   - **Look-at & Attention System**: Smooth quaternion head/eye rotation tracking cursor coordinates and active chat windows.
   - **Seamless Mode Switching**:
     - *Studio Mode*: Full-screen workstation with animation controls, timeline scrubbers, Character Forge skin painter, and prompt inspector.
     - *Companion Mode*: Floating, borderless desktop companion widget with expandable interaction bubble.

3. **Character Forge & Personality Engine**:
   - Live 64x64 texture canvas editor with real-time 3D unwrapping.
   - Procedural skin builder with customizable palettes (hair, eyes, hoodie, headset).
   - 3 Pre-installed Personality Packs: *Sunday Classic*, *Hacker Mode*, *Chill Mentor*.
   - Portable `.sunday` package export/import.

4. **Telemetry & Live Efficiency HUD**:
   - Real-time CPU, RAM, VRAM, latency (ms), and tokens/sec readouts.
   - Glowing **`OFFLINE ✓`** verification badge demonstrating true local execution.

---

## 4. Fragile Spots & Risk Mitigations

| Vulnerability / Fragile Spot | Root Cause | Architectural Mitigation |
| :--- | :--- | :--- |
| **Missing local LLM or Python** | Environment setup friction | **Dual-Engine Architecture**: Production connector for Ollama/Python + built-in Zero-Dependency Node.js Mock/Fallback Engine with pre-computed neural responses. |
| **Voice-to-Reaction Lag (>1.5s)** | Whisper model warm-up & VAD delay | **Pre-warming & Streaming**: Pre-warm models on app start; trigger visual "Listening" state instantly on microphone activity before transcription finishes. |
| **Emotion Tag Leakage** | LLM outputs raw JSON tags into chat | **Strict Regex Filter Pipeline**: Emotion parser extracts `{"emotion":"...","gesture":"..."}` before passing clean speech text to TTS or screen captions. |
| **VRAM Overflow on 6GB GPU** | Running 7B model + Whisper concurrently | Quantized 3B instruct models (`llama3.2:3b` / `qwen2.5:3b`) auto-selected, leaving >3.5 GB VRAM buffer. |
| **Character Rendering Stutter** | High draw calls from individual voxels | Grouped bone hierarchy with shared material instances; guaranteed 60 FPS. |

---

## 5. Ranked Implementation Plan (Phases 1 - 5)

### Phase 1: Foundation, Event Bus & Hero Flow Skeleton
- Initialize `package.json` with Electron/Node/Three.js ecosystem.
- Build high-performance WebSocket/HTTP bridge (`server.js`, port 8765) with state machine (`sleeping` -> `listening` -> `thinking` -> `talking` -> `working` -> `celebrating`).
- Implement startup checklist ("Mic ✓ STT ✓ LLM ✓ TTS ✓ Avatar ✓").
- Build `scripts/demo.bat` and `tests/smoke_test.js` to guarantee 10 flawless runs offline.

### Phase 2: WOW 1 — The Living Character
- Implement Three.js voxel avatar with messy brown hair, green "S" hoodie, and headset.
- Build the 20+ keyframe animation set with 150-250ms cross-fading and additive breathing/blinking.
- Implement cursor-following eye/head attention and Web Audio amplitude lip-sync.
- Implement `emotion.js` parser for structured emotion tags.

### Phase 3: WOW 2 — Character Forge & Personality Packs
- Build Character Forge interactive 3D skin texture editor (64x64 canvas, palette sliders).
- Create 3 distinct personality packs (Classic, Hacker, Chill Mentor) with hot-reloading.
- Implement portable `.sunday` export and import system.

### Phase 4: WOW 3 — "Works for You" (Local Skills & Memory)
- Skill 1: Private Folder Q&A with file citation.
- Skill 2: "Code with Agent" sandbox with animated "Working" state and celebrating payoff.
- Skill 3: Voice utilities (app launcher, clipboard explainer, timer).
- Persistent SQLite/JSON memory module ("Sunday remembers...").

### Phase 5: Extras, World-Class Polish & Packaging
- Efficiency overlay (real-time RAM/VRAM/FPS/latency + OFFLINE ✓ badge).
- Proactive nudge trigger (idle stretch / low battery).
- Companion mode toggle (dockable compact view).
- Complete documentation: `README.md`, `BENCHMARKS.md`, `DEMO_SCRIPT.md`, and `PITCH.md`.
