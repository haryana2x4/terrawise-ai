/**
 * STORMFORGE SKY-CITADEL: Character B "Flicker" (Teleporting Static Fox Spirit)
 * Small 60-80px fox-like spirit made of glowing static, pale gold and electric blue.
 * Spinning halo, contracting/expanding halo teleport + 12 sparks, 70px evasion,
 * safe spot selection via document.elementsFromPoint, Skybolt laser miss gag & 1-in-15 swap gag.
 */

class FlickerSpirit {
  constructor(canvas, audioBed = null, skyboltRig = null) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = audioBed;
    this.skybolt = skyboltRig;

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.active = true;
    this.x = -100;
    this.y = -100;
    this.targetX = -100;
    this.targetY = -100;
    this.scale = 1.0;
    this.alpha = 1.0;
    this.rotation = 0;
    this.somersault = 0; // angle when clicked

    this.haloRadius = 16;
    this.haloRotation = 0;
    this.tailSway = 0;

    // State machine: 'idle' | 'collapsing' | 'hidden' | 'expanding'
    this.state = 'idle';
    this.stateTimer = 0;
    this.sightings = parseInt(localStorage.getItem('flicker:sightings') || '0', 10);

    this.sparks = [];
    this.scorchDecals = [];

    this.nextTeleportTime = performance.now() + 5000;
    this.stayDuration = 4000;

    this.setupCanvas();
    this.setupEvents();
    this.teleportToSafeSpot(false);
  }

  setupCanvas() {
    this.canvas.id = 'flicker-spirit-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none'; // Clicks handled via mouse tracking
    this.canvas.style.zIndex = '9998';

    if (!document.body.contains(this.canvas)) {
      document.body.appendChild(this.canvas);
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  setupEvents() {
    // Cursor evasion within 70px & Click detection
    window.addEventListener('mousemove', (e) => {
      if (!this.active || this.state === 'collapsing' || this.state === 'hidden') return;
      const dx = e.clientX - this.x;
      const dy = e.clientY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 70) {
        // Evasion trigger!
        this.triggerTeleport(true);
      }
    });

    window.addEventListener('click', (e) => {
      if (!this.active || this.state === 'hidden') return;
      const dx = e.clientX - this.x;
      const dy = e.clientY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 45) {
        // Direct click on Flicker!
        this.onClickFlicker();
      }
    });
  }

  onClickFlicker() {
    this.sightings++;
    localStorage.setItem('flicker:sightings', this.sightings.toString());
    if (this.audio) this.audio.playPop();

    // Trigger celebratory somersault
    this.somersault = Math.PI * 2;

    // Dispatch sightings custom event
    window.dispatchEvent(new CustomEvent('flicker:sighting', { detail: { count: this.sightings } }));

    // Update sightings pill in cast panel if present
    const countEl = document.getElementById('cast-sightings-count');
    if (countEl) countEl.textContent = this.sightings;

    setTimeout(() => {
      this.triggerTeleport(true);
    }, 450);
  }

  findSafeSpot() {
    const margin = 80;
    const maxTries = 25;

    for (let i = 0; i < maxTries; i++) {
      const testX = margin + Math.random() * (this.width - margin * 2);
      const testY = margin + Math.random() * (this.height - margin * 2);

      // Check what elements are at testX, testY
      const elements = document.elementsFromPoint(testX, testY) || [];
      let isUnsafe = false;

      for (const el of elements) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select' ||
            tag === 'a' || el.classList.contains('nav-tab') || el.classList.contains('card-btn')) {
          isUnsafe = true;
          break;
        }
      }

      if (!isUnsafe) {
        return { x: testX, y: testY };
      }
    }

    // Default fallback to safe header margin
    return { x: this.width * 0.85, y: 120 };
  }

  triggerTeleport(isEmergency = false) {
    if (this.state === 'collapsing' || this.state === 'hidden') return;

    this.state = 'collapsing';
    this.stateTimer = performance.now();
    if (this.audio) this.audio.playPop();

    // Spawn 12 directional static sparks
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = Math.random() * 4 + 3;
      this.sparks.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#fef08a' : '#38bdf8',
        life: 1.0,
        decay: Math.random() * 2.5 + 2.5
      });
    }

    // Rare 1-in-15 teleport swap gag
    const shouldSwapWithHero = Math.random() < (1 / 15);

    setTimeout(() => {
      this.state = 'hidden';
      const safe = this.findSafeSpot();

      if (shouldSwapWithHero) {
        this.executeSwapGag(safe);
      } else {
        setTimeout(() => {
          this.x = safe.x;
          this.y = safe.y;
          this.state = 'expanding';
          this.stateTimer = performance.now();
          this.haloRadius = 2;

          // Idle schedule
          const stayTime = Math.random() * 4000 + 2000;
          this.nextTeleportTime = performance.now() + stayTime;

          // 1 in 4 chance of Skybolt laser miss gag
          if (Math.random() < 0.25) {
            this.triggerSkyboltLaserGag();
          }
        }, 150);
      }
    }, 150);
  }

  executeSwapGag(safe) {
    // Skybolt position in viewport center-ish
    const heroX = this.width * 0.5;
    const heroY = this.height * 0.38;

    this.x = heroX;
    this.y = heroY;
    this.state = 'expanding';
    this.stateTimer = performance.now();

    const heroPill = document.getElementById('nav-state-label');
    if (heroPill) heroPill.textContent = 'SWAPPED?!';

    // Swap back after 2s
    setTimeout(() => {
      this.triggerTeleport(true);
      if (heroPill && heroPill.textContent === 'SWAPPED?!') heroPill.textContent = 'IDLE';
    }, 2000);
  }

  triggerSkyboltLaserGag() {
    const heroPill = document.getElementById('nav-state-label');
    if (heroPill) heroPill.textContent = 'TARGETING';

    setTimeout(() => {
      if (this.state !== 'idle') return;

      // Emergency teleport 50ms before laser impact!
      const targetX = this.x;
      const targetY = this.y;

      setTimeout(() => {
        this.triggerTeleport(true);
      }, 350);

      // Laser impact at 400ms
      setTimeout(() => {
        if (this.audio) this.audio.playLaser();
        // Scorch decal at targetX, targetY
        this.scorchDecals.push({
          x: targetX,
          y: targetY,
          alpha: 1.0,
          created: performance.now()
        });

        if (heroPill) heroPill.textContent = 'BAFFLED';
        setTimeout(() => {
          if (heroPill && heroPill.textContent === 'BAFFLED') heroPill.textContent = 'IDLE';
        }, 1800);
      }, 400);
    }, 600);
  }

  teleportToSafeSpot(animate = true) {
    const safe = this.findSafeSpot();
    if (!animate) {
      this.x = safe.x;
      this.y = safe.y;
      this.state = 'idle';
      this.haloRadius = 16;
      this.nextTeleportTime = performance.now() + 6000;
    } else {
      this.triggerTeleport();
    }
  }

  update(delta) {
    if (!this.active) return;
    const now = performance.now();

    // Check scheduled teleport
    if (this.state === 'idle' && now >= this.nextTeleportTime) {
      this.triggerTeleport(false);
    }

    // Halo animation & Tail sway
    this.haloRotation += delta * 4;
    this.tailSway = Math.sin(now * 0.005) * 0.4;

    // Somersault recovery
    if (this.somersault > 0) {
      this.somersault = Math.max(0, this.somersault - delta * 12);
    }

    // Teleport collapsing
    if (this.state === 'collapsing') {
      const elapsed = now - this.stateTimer;
      this.haloRadius = Math.max(2, 16 * (1 - elapsed / 150));
      this.alpha = Math.max(0, 1 - elapsed / 150);
      if (elapsed >= 150) {
        this.state = 'hidden';
      }
    } else if (this.state === 'expanding') {
      const elapsed = now - this.stateTimer;
      this.haloRadius = Math.min(16, 2 + 14 * (elapsed / 200));
      this.alpha = Math.min(1.0, elapsed / 200);
      if (elapsed >= 200) {
        this.state = 'idle';
      }
    }

    // Sparks update
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= delta * s.decay;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    // Scorch decals fade over 3s
    for (let i = this.scorchDecals.length - 1; i >= 0; i--) {
      const d = this.scorchDecals[i];
      const age = now - d.created;
      d.alpha = Math.max(0, 1 - age / 3000);
      if (d.alpha <= 0) this.scorchDecals.splice(i, 1);
    }
  }

  render() {
    if (!this.active) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Scorch Decals
    for (const d of this.scorchDecals) {
      ctx.save();
      ctx.globalAlpha = d.alpha * 0.7;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glowing ember edge
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Sparks
    for (const s of this.sparks) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw Flicker Body (if not hidden)
    if (this.state === 'hidden') return;

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.somersault > 0) {
      ctx.rotate(this.somersault);
    }
    ctx.globalAlpha = this.alpha;

    // Static Fox Spirit (60-80px)
    // Spinning Halo above head
    ctx.save();
    ctx.translate(0, -32);
    ctx.rotate(this.haloRotation);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.haloRadius, this.haloRadius * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Fox Body (Electric Cyan & Soft Gold Gradient)
    const bodyGrad = ctx.createLinearGradient(-15, -15, 15, 20);
    bodyGrad.addColorStop(0, '#bae6fd');
    bodyGrad.addColorStop(0.5, '#38bdf8');
    bodyGrad.addColorStop(1, '#0284c7');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fox Head & Ears
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.lineTo(-18, -28); // Left ear tip
    ctx.lineTo(-4, -18);
    ctx.lineTo(4, -18);
    ctx.lineTo(18, -28); // Right ear tip
    ctx.lineTo(12, -14);
    ctx.closePath();
    ctx.fill();

    // Ear Inner Glow
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(-11, -15);
    ctx.lineTo(-16, -25);
    ctx.lineTo(-6, -18);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(11, -15);
    ctx.lineTo(16, -25);
    ctx.lineTo(6, -18);
    ctx.closePath();
    ctx.fill();

    // Eyes (Static glowing dots)
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(-5, -12, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Long Ringed Tail (with tail sway)
    ctx.save();
    ctx.translate(0, 14);
    ctx.rotate(this.tailSway);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(22, 12, 28, 30);
    ctx.stroke();

    // Tail Gold Rings
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(14, 8, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(24, 22, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Random Static Sparkles on Fur
    if (Math.random() < 0.4) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 24, 2, 2);
    }

    ctx.restore();
  }
}

// Global window registration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FlickerSpirit };
}
if (typeof window !== 'undefined') {
  window.FlickerSpirit = FlickerSpirit;
}
