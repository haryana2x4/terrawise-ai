# SUNDAY v2 — 3D Enderman Studio

Local-first 3D voxel companion and real-time WebGL simulation studio built with Node.js, Three.js, and WebSockets.

## Quick Start

```bash
npm install
node server.js
```

Open `http://127.0.0.1:8765` in your browser.

## Features

- **Real-Time 3D Voxel Rig**: 60 FPS Three.js character state machine (`idle`, `listening`, `thinking`, `talking`, `working`, `celebrating`) with procedural breathing, eye tracking, and lip-sync.
- **Character Forge**: Live 64x64 texture skin painter and `.sunday` character profile bundler.
- **Stormforge Sky-Citadel**: Procedural Stormwyrm Vael flight transitions, dynamic time-of-day lighting, and WebAudio synthesis.
- **Local Skills**: Private document Q&A and sandboxed code runner.

## Tests

```bash
node tests/smoke_test.js
node tests/eval_suite.js
node tests/expansion_suite.js
```
