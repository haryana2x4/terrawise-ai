/**
 * Procedural Web Audio Sound Synthesizer for Beyond Earth & ORION
 * 100% zero external audio assets — synthesizes realistic spaceflight telemetry,
 * Ender teleport whooshes, ominous stare resonance, and holographic chirps at runtime.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      const stored = localStorage.getItem("beyond-earth.sound.muted");
      this.muted = stored === "true";
    } catch {
      this.muted = false;
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem("beyond-earth.sound.muted", String(muted));
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Authentic Minecraft Ender Teleport Sound
   * Deep sub-bass drop + white noise portal burst + resonant high sweep
   */
  public playTeleport() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. White noise burst for portal rush
    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1400, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(160, now + 0.4);
    noiseFilter.Q.setValueAtTime(4.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Sub-bass warp tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.38);

    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  /**
   * Holographic UI Chirp / Confirmation
   */
  public playChirp() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.04);
    osc.frequency.setValueAtTime(1760, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Terrifying Ender Stare / Rage Drone
   * Heavy detuned saw waves + resonant low-pass filter
   */
  public playEnderStare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(75, now);
    osc2.frequency.setValueAtTime(78.5, now); // Detuned beat frequency

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.linearRampToValueAtTime(850, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(200, now + 1.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.25);
    osc2.stop(now + 1.25);
  }

  /**
   * Interactive Gesture Swish
   */
  public playGesture() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.14);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Authentic Minecraft Ender Dragon Roar & Wing Flap
   * Deep guttural roar + resonant low pass + wing buffet noise
   */
  public playDragonRoar() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Dragon Growl / Roar (two detuned saw oscillators)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const roarFilter = ctx.createBiquadFilter();
    const roarGain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(54, now + 1.4);
    osc2.frequency.setValueAtTime(114, now);
    osc2.frequency.exponentialRampToValueAtTime(52, now + 1.4);

    roarFilter.type = "bandpass";
    roarFilter.frequency.setValueAtTime(480, now);
    roarFilter.frequency.exponentialRampToValueAtTime(210, now + 1.3);
    roarFilter.Q.setValueAtTime(3.2, now);

    roarGain.gain.setValueAtTime(0.3, now);
    roarGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    osc1.connect(roarFilter);
    osc2.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);

    // 2. Dragon Wing Buffet (wind rush)
    const bufferSize = Math.floor(ctx.sampleRate * 0.9);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(280, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Ender Pearl Throw Sound (Whistling Ballistic Arc)
   */
  public playPearlThrow() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  /**
   * Cute Petting / Scratching Chirp
   */
  public playPetChirp() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Procedural Beatbox Drop (Kick, Snare, Hi-Hat Sequence)
   */
  public playBeatboxBeat() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Kick Drum (Heavy pitch drop)
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.frequency.setValueAtTime(140, now);
    kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
    kickGain.gain.setValueAtTime(0.4, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.15);

    // 2. Hi-Hat at +0.15s
    const hatBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
    const hatData = hatBuffer.getChannelData(0);
    for (let i = 0; i < hatData.length; i++) {
      hatData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
    }
    const hat = ctx.createBufferSource();
    hat.buffer = hatBuffer;
    const hatGain = ctx.createGain();
    hatGain.gain.setValueAtTime(0.18, now + 0.15);
    hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    hat.connect(hatGain);
    hatGain.connect(ctx.destination);
    hat.start(now + 0.15);

    // 3. Snare at +0.28s
    const snareOsc = ctx.createOscillator();
    const snareGain = ctx.createGain();
    snareOsc.frequency.setValueAtTime(220, now + 0.28);
    snareOsc.frequency.exponentialRampToValueAtTime(90, now + 0.38);
    snareGain.gain.setValueAtTime(0.25, now + 0.28);
    snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    snareOsc.connect(snareGain);
    snareGain.connect(ctx.destination);
    snareOsc.start(now + 0.28);
    snareOsc.stop(now + 0.42);

    // 4. Second Kick at +0.44s
    const kick2Osc = ctx.createOscillator();
    const kick2Gain = ctx.createGain();
    kick2Osc.frequency.setValueAtTime(130, now + 0.44);
    kick2Osc.frequency.exponentialRampToValueAtTime(32, now + 0.56);
    kick2Gain.gain.setValueAtTime(0.35, now + 0.44);
    kick2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    kick2Osc.connect(kick2Gain);
    kick2Gain.connect(ctx.destination);
    kick2Osc.start(now + 0.44);
    kick2Osc.stop(now + 0.6);
  }
}

export const sound = new SoundEngine();
