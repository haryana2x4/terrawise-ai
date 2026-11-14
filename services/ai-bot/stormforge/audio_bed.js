/**
 * STORMFORGE SKY-CITADEL: Procedural WebAudio Bed & SFX
 * Zero external audio files. 100% synthesized offline via WebAudio oscillators & noise nodes.
 */

class AudioBed {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.isMuted = true; // Default off
    this.windNode = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioContext) return;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.startAmbientBed();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(override = null) {
    this.ensureContext();
    this.isMuted = override !== null ? override : !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }

  duckAmbient(durationMs = 1500) {
    if (!this.ctx) return;
    this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.ambientGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    this.ambientGain.gain.setTargetAtTime(0.3, this.ctx.currentTime + (durationMs / 1000), 0.5);
  }

  startAmbientBed() {
    // 1. Procedural Pink-Noise Wind
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.08;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    // Subtle wind oscillation (LFO)
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(200, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    whiteNoise.connect(filter);
    filter.connect(this.ambientGain);

    whiteNoise.start(0);
    lfo.start(0);

    // Periodic distant crystal chimes
    setInterval(() => {
      if (!this.isMuted && Math.random() > 0.4) {
        this.playCrystalChime();
      }
    }, 7000);
  }

  playCrystalChime() {
    if (!this.ctx || this.isMuted) return;
    const freqs = [1046.5, 1318.5, 1567.98, 2093.0]; // High C, E, G, C
    const f = freqs[Math.floor(Math.random() * freqs.length)];
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, this.ctx.currentTime);
    g.gain.setValueAtTime(0.04, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.5);
    osc.connect(g);
    g.connect(this.ambientGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 2.5);
  }

  // SFX: Flicker Pop & Sparkle
  playPop() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // SFX: Laser Blast
  playLaser() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.22);
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  // SFX: Thunder Rumble & Dragon Roar (for Vael)
  playThunderRoar() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    this.duckAmbient(2500);

    // Low roar oscillator
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 1.2);
    g.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.4);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.4);

    // Noise crackle
    const bSize = this.ctx.sampleRate * 1.0;
    const b = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1) * 0.15;
    const noise = this.ctx.createBufferSource();
    noise.buffer = b;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(300, this.ctx.currentTime);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    nGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);
    noise.connect(filt);
    filt.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start();
  }

  // SFX: Soft Reticle Tick
  playTick() {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
    g.gain.setValueAtTime(0.05, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.04);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioBed };
}
if (typeof window !== 'undefined') {
  window.AudioBed = AudioBed;
}

