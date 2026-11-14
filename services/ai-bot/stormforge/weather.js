/**
 * STORMFORGE SKY-CITADEL: Atmospheric Weather & Parallax Floating Islands
 * Renders 3 parallax island depths, crystal spires, pulsing rune bridges,
 * aurora ribbons, distant lightning, and storm rain.
 */

class WeatherSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.stormIntensity = 0.0; // 0.0 (calm) to 1.0 (heavy storm)
    this.lightningFlash = 0.0;
    this.rainDrops = [];
    this.stars = [];
    this.time = 0;

    this.initParticles();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  initParticles() {
    // Starfield for night
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.7,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }

    // Pooled rain streaks
    for (let i = 0; i < 120; i++) {
      this.rainDrops.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        length: Math.random() * 18 + 12,
        speed: Math.random() * 14 + 16,
        alpha: Math.random() * 0.4 + 0.2
      });
    }
  }

  spikeStorm(intensity = 1.0) {
    this.stormIntensity = intensity;
    this.lightningFlash = 0.9;
  }

  update(delta) {
    this.time += delta;

    // Decay storm intensity over ~8s
    if (this.stormIntensity > 0) {
      this.stormIntensity = Math.max(0, this.stormIntensity - delta * 0.12);
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - delta * 2.5);
    }

    // Rare ambient far lightning
    if (Math.random() < 0.002 * (1 + this.stormIntensity * 5)) {
      this.lightningFlash = Math.random() * 0.4 + 0.2;
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    const period = document.documentElement.getAttribute('data-time-of-day') || 'night';

    // 1. Stars (active during night/dusk)
    if (period === 'night' || period === 'dusk') {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        const a = (Math.sin(this.time * 2 + s.twinkle) * 0.4 + 0.6) * (period === 'night' ? 0.8 : 0.3);
        ctx.globalAlpha = a;
        ctx.fillRect(s.x * w, s.y * h, s.size, s.size);
      }
    }

    // 2. Aurora Ribbons (Curved sinuous gradients)
    ctx.save();
    const auroraAlpha = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--aurora-opacity') || '0.5');
    if (auroraAlpha > 0.05) {
      ctx.globalAlpha = auroraAlpha * (1 + Math.sin(this.time * 0.8) * 0.15);
      const grad = ctx.createLinearGradient(0, 0, w, h * 0.5);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      grad.addColorStop(0.3, 'rgba(16, 185, 129, 0.2)');
      grad.addColorStop(0.7, 'rgba(139, 92, 246, 0.15)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, h * 0.15);
      for (let x = 0; x <= w; x += 40) {
        const y = h * 0.18 + Math.sin(x * 0.003 + this.time * 0.6) * 45 + Math.cos(x * 0.001 - this.time * 0.4) * 25;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. Floating Islands at 3 Parallax Depths
    this.renderFloatingIslands(ctx, w, h);

    // 4. Rain streaks if storm active
    if (this.stormIntensity > 0.05) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      for (const r of this.rainDrops) {
        r.y += r.speed * (0.8 + this.stormIntensity);
        r.x -= 2.5; // Wind cant
        if (r.y > h) { r.y = -20; r.x = Math.random() * (w + 200); }
        ctx.globalAlpha = r.alpha * this.stormIntensity;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - 4, r.y + r.length);
        ctx.stroke();
      }
    }

    // 5. Ambient Lightning Flash
    if (this.lightningFlash > 0.02) {
      ctx.fillStyle = '#e0f2fe';
      ctx.globalAlpha = this.lightningFlash * 0.45;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = 1.0;
  }

  renderFloatingIslands(ctx, w, h) {
    const t = this.time;

    // Depth 1: Far Island with Crystal Spire (slowest bob)
    const y1 = h * 0.32 + Math.sin(t * 0.5) * 8;
    this.drawIsland(ctx, w * 0.18, y1, 140, 45, '#07101e', '#030810', true);

    // Depth 2: Mid Island with Skyline Spires
    const y2 = h * 0.45 + Math.sin(t * 0.7 + 1) * 12;
    this.drawIsland(ctx, w * 0.82, y2, 220, 65, '#0a172c', '#040912', true);

    // Depth 3: Near Island Base
    const y3 = h * 0.68 + Math.sin(t * 0.9 + 2) * 15;
    this.drawIsland(ctx, w * 0.5, y3, 340, 90, '#0d1f3b', '#060f1c', false);

    // Pulsing Rune Bridges connecting islands
    this.drawRuneBridge(ctx, w * 0.18, y1, w * 0.5, y3);
    this.drawRuneBridge(ctx, w * 0.5, y3, w * 0.82, y2);
  }

  drawIsland(ctx, cx, cy, rx, ry, colorTop, colorBot, hasSpire) {
    ctx.save();
    // Top plateau
    const grad = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry * 2);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBot);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Under-keel (rugged rock base)
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx + rx * 0.2, cy + ry * 1.8);
    ctx.lineTo(cx - rx * 0.3, cy + ry * 2.2);
    ctx.closePath();
    ctx.fill();

    // Crystal Spire
    if (hasSpire) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry * 2.2);
      ctx.lineTo(cx - 8, cy - ry * 0.3);
      ctx.lineTo(cx + 8, cy - ry * 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawRuneBridge(ctx, x1, y1, x2, y2) {
    ctx.save();
    const pulse = Math.sin(this.time * 2.5) * 0.3 + 0.6;
    ctx.strokeStyle = `rgba(6, 182, 212, ${0.25 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.lineDashOffset = -this.time * 20;

    ctx.beginPath();
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + 30; // sag
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WeatherSystem };
}
if (typeof window !== 'undefined') {
  window.WeatherSystem = WeatherSystem;
}

