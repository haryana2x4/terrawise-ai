/**
 * STORMFORGE SKY-CITADEL: Stormwyrm "Vael" Procedural Transition Engine
 * 36-segment follow-the-leader Catmull-Rom procedural sky serpent.
 * 3 Path variants: Wide Arc, Loop-the-Loop, Dive-and-Climb.
 * Scales 1.0x -> 1.8x at mid-pass with teal-white flash hiding the content swap.
 * Fully compliant with MPA two-phase & SPA route transitions.
 */

class StormwyrmVael {
  constructor(canvas, weatherSystem = null, audioBed = null) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.weather = weatherSystem;
    this.audio = audioBed;
    this.active = false;
    this.progress = 0; // 0 to 1
    this.duration = 1150; // ms (between 1000 and 1300)
    this.startTime = 0;
    this.swapTriggered = false;
    this.swapCallback = null;
    this.variant = 'wideArc'; // 'wideArc' | 'loopTheLoop' | 'diveAndClimb'
    this.direction = 1; // 1: left->right (forward), -1: right->left (back)
    this.phase = 'full'; // 'full' (SPA) | 'phaseA' (before unload) | 'phaseB' (after load)
    this.skin = (typeof localStorage !== 'undefined' ? localStorage.getItem('stormforge:dragon_skin') : null) || 'enderDragon'; // 'enderDragon' | 'stormwyrm'

    // Segment setup
    this.segmentCount = 36;
    this.segments = [];
    for (let i = 0; i < this.segmentCount; i++) {
      this.segments.push({ x: -100, y: -100, angle: 0 });
    }

    // Whisker ribbons (Verlet nodes)
    this.whiskersLeft = Array.from({ length: 6 }, () => ({ x: -100, y: -100, oldX: -100, oldY: -100 }));
    this.whiskersRight = Array.from({ length: 6 }, () => ({ x: -100, y: -100, oldX: -100, oldY: -100 }));

    // Cloud wisp particles
    this.wisps = [];

    this.setupCanvas();
    this.checkSessionTransition();
    this.hookLinkNavigation();
  }

  setupCanvas() {
    this.canvas.id = 'vael-transition-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '99999';
    this.canvas.style.display = 'none';

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

  checkSessionTransition() {
    try {
      const dataStr = sessionStorage.getItem('hero:transition');
      if (dataStr) {
        sessionStorage.removeItem('hero:transition');
        const data = JSON.parse(dataStr);
        // Start Phase B (exit from peak coverage)
        setTimeout(() => {
          this.startPhaseB(data.variant || 'wideArc', data.direction || 1);
        }, 30);
      }
    } catch (e) {
      console.warn('Session transition read error:', e);
    }
  }

  hookLinkNavigation() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      // Check if internal navigation (e.g., /project, index.html)
      const isInternal = href.startsWith('/') || href.endsWith('.html') || (link.hostname === window.location.hostname);
      if (isInternal && !e.ctrlKey && !e.metaKey && !e.shiftKey && link.target !== '_blank') {
        const url = new URL(link.href, window.location.href);
        if (url.pathname !== window.location.pathname) {
          e.preventDefault();
          this.navigateWithTransition(link.href);
        }
      }
    });

    // Also support popstate (browser back/forward)
    window.addEventListener('popstate', () => {
      this.playTransition({
        direction: -1,
        variant: 'wideArc'
      });
    });
  }

  navigateWithTransition(targetUrl) {
    if (this.active) return;
    const variants = ['wideArc', 'loopTheLoop', 'diveAndClimb'];
    const chosenVariant = variants[Math.floor(Math.random() * variants.length)];
    const direction = 1;

    // Phase A -> Save to session, trigger flash, then swap
    this.active = true;
    this.phase = 'phaseA';
    this.variant = chosenVariant;
    this.direction = direction;
    this.progress = 0;
    this.swapTriggered = false;
    this.canvas.style.display = 'block';
    this.startTime = performance.now();

    if (this.audio) this.audio.playThunderRoar();
    if (this.weather) this.weather.spikeStorm(1.0);
    this.triggerSecondaryEffects();

    this.swapCallback = () => {
      try {
        sessionStorage.setItem('hero:transition', JSON.stringify({
          variant: this.variant,
          direction: this.direction
        }));
      } catch (err) {}
      window.location.href = targetUrl;
    };
  }

  startPhaseB(variant, direction) {
    this.active = true;
    this.phase = 'phaseB';
    this.variant = variant;
    this.direction = direction;
    this.progress = 0.45; // Start at peak flash
    this.swapTriggered = true;
    this.canvas.style.display = 'block';
    this.startTime = performance.now() - (this.duration * 0.45);
    if (this.weather) this.weather.spikeStorm(0.6);
  }

  playTransition(options = {}) {
    if (this.active) return Promise.resolve();
    return new Promise((resolve) => {
      this.active = true;
      this.phase = 'full';
      const variants = ['wideArc', 'loopTheLoop', 'diveAndClimb'];
      this.variant = options.variant || variants[Math.floor(Math.random() * variants.length)];
      this.direction = options.direction !== undefined ? options.direction : 1;
      this.progress = 0;
      this.swapTriggered = false;
      this.canvas.style.display = 'block';
      this.startTime = performance.now();

      if (this.audio) this.audio.playThunderRoar();
      if (this.weather) this.weather.spikeStorm(1.0);
      this.triggerSecondaryEffects();

      this.swapCallback = () => {
        if (options.onSwap) options.onSwap();
      };

      this.onComplete = () => {
        resolve();
      };
    });
  }

  triggerSecondaryEffects() {
    // 1. Screen Shake (3px)
    const body = document.body;
    let shakeCount = 0;
    const shakeInterval = setInterval(() => {
      shakeCount++;
      const dx = (Math.random() - 0.5) * 6;
      const dy = (Math.random() - 0.5) * 6;
      body.style.transform = `translate(${dx}px, ${dy}px)`;
      if (shakeCount > 10) {
        clearInterval(shakeInterval);
        body.style.transform = '';
      }
    }, 25);

    // 2. Wind gust nudging cards (parallax kick)
    const cards = document.querySelectorAll('.card, .glass-card, .tool-card, .metric-card');
    cards.forEach((c) => {
      c.style.transition = 'transform 0.3s cubic-bezier(0.1, 0.9, 0.2, 1)';
      c.style.transform = `translateY(-6px) scale(1.015)`;
      setTimeout(() => {
        c.style.transform = '';
      }, 500);
    });

    // 3. Skybolt looks up & shields eyes
    const heroPill = document.getElementById('nav-state-label');
    if (heroPill) {
      heroPill.textContent = 'DEFENDING';
      setTimeout(() => {
        if (heroPill.textContent === 'DEFENDING') heroPill.textContent = 'IDLE';
      }, 1500);
    }
  }

  // Path Generators for Catmull-Rom
  getPathPoint(t) {
    const w = this.width;
    const h = this.height;
    const dir = this.direction;

    // t is 0.0 to 1.0 along the transition
    // Adjust x based on direction
    let startX = dir === 1 ? -w * 0.4 : w * 1.4;
    let endX = dir === 1 ? w * 1.4 : -w * 0.4;

    let x = startX + (endX - startX) * t;
    let y = h * 0.5;

    if (this.variant === 'wideArc') {
      // Sweeping majestic arc across screen with 1.5 sine wobble
      const wobble = Math.sin(t * Math.PI * 3) * (h * 0.12);
      const arc = Math.sin(t * Math.PI) * (h * 0.45);
      y = h * 0.85 - arc + wobble;
    } else if (this.variant === 'loopTheLoop') {
      // Loop-the-loop in the center of the screen
      if (t >= 0.3 && t <= 0.7) {
        const loopT = (t - 0.3) / 0.4; // 0 to 1
        const loopAngle = loopT * Math.PI * 2;
        const loopRadius = Math.min(w, h) * 0.28;
        const centerX = w * 0.5;
        const centerY = h * 0.45;
        x = centerX + Math.sin(loopAngle) * loopRadius * dir;
        y = centerY - Math.cos(loopAngle) * loopRadius;
      } else if (t < 0.3) {
        const segT = t / 0.3;
        x = startX + (w * 0.5 - startX) * segT;
        y = h * 0.75 - segT * (h * 0.3);
      } else {
        const segT = (t - 0.7) / 0.3;
        x = w * 0.5 + (endX - w * 0.5) * segT;
        y = h * 0.45 + segT * (h * 0.4);
      }
    } else if (this.variant === 'diveAndClimb') {
      // Swoop down from top, skim lower third, climb into upper corner
      const u = t;
      const dive = Math.sin(u * Math.PI);
      y = h * 0.2 + dive * (h * 0.65) + Math.sin(u * Math.PI * 4) * 20;
    }

    return { x, y };
  }

  update(delta) {
    if (!this.active) return;

    const now = performance.now();
    this.progress = (now - this.startTime) / this.duration;

    if (this.progress >= 1.0) {
      this.active = false;
      this.canvas.style.display = 'none';
      if (this.onComplete) this.onComplete();
      return;
    }

    // Trigger Swap at peak coverage (~45%)
    if (this.progress >= 0.45 && !this.swapTriggered) {
      this.swapTriggered = true;
      if (this.swapCallback) this.swapCallback();
    }

    // Follow-the-leader kinematics
    const headT = Math.min(1.0, Math.max(0.0, this.progress * 1.3));
    const headTarget = this.getPathPoint(headT);

    // Update head
    this.segments[0].x = headTarget.x;
    this.segments[0].y = headTarget.y;

    // Trailing segments follow
    const spacing = 22;
    for (let i = 1; i < this.segmentCount; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];
      const dx = prev.x - curr.x;
      const dy = prev.y - curr.y;
      const dist = Math.hypot(dx, dy) || 1;
      const angle = Math.atan2(dy, dx);
      curr.angle = angle;
      curr.x = prev.x - Math.cos(angle) * spacing;
      curr.y = prev.y - Math.sin(angle) * spacing;
    }

    // Update whiskers (Verlet)
    const head = this.segments[0];
    const headAngle = Math.atan2(head.y - this.segments[1].y, head.x - this.segments[1].x);
    this.updateWhisker(this.whiskersLeft, head.x, head.y, headAngle + 0.6);
    this.updateWhisker(this.whiskersRight, head.x, head.y, headAngle - 0.6);

    // Spawn cloud wisps from tail
    const tail = this.segments[this.segmentCount - 1];
    if (Math.random() < 0.6) {
      this.wisps.push({
        x: tail.x + (Math.random() - 0.5) * 20,
        y: tail.y + (Math.random() - 0.5) * 20,
        r: Math.random() * 25 + 15,
        alpha: 0.65,
        vx: (Math.random() - 0.5) * 2 - (this.direction * 3),
        vy: (Math.random() - 0.5) * 2
      });
    }

    // Update wisps
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      w.x += w.vx;
      w.y += w.vy;
      w.r += 0.8;
      w.alpha -= delta * 0.9;
      if (w.alpha <= 0) this.wisps.splice(i, 1);
    }
  }

  updateWhisker(chain, rootX, rootY, angle) {
    chain[0].x = rootX;
    chain[0].y = rootY;
    for (let i = 1; i < chain.length; i++) {
      const node = chain[i];
      const prev = chain[i - 1];
      const vx = (node.x - node.oldX) * 0.85;
      const vy = (node.y - node.oldY) * 0.85;
      node.oldX = node.x;
      node.oldY = node.y;
      node.x += vx;
      node.y += vy + 0.5; // slight gravity

      const dx = node.x - prev.x;
      const dy = node.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetDist = 14;
      node.x = prev.x + (dx / dist) * targetDist;
      node.y = prev.y + (dy / dist) * targetDist;
    }
  }

  render() {
    if (!this.active) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    // Mid-pass camera depth scale: 1.0x -> 1.8x at peak
    const depthCurve = Math.sin(this.progress * Math.PI); // 0 at ends, 1.0 at mid
    const scale = 1.0 + depthCurve * 0.8;

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    // 1. Draw Wisps / Ender Portal Particles
    for (const wisp of this.wisps) {
      if (this.skin === 'enderDragon') {
        ctx.fillStyle = `rgba(192, 132, 252, ${wisp.alpha * 0.45})`;
        ctx.fillRect(wisp.x - wisp.r * 0.4, wisp.y - wisp.r * 0.4, wisp.r * 0.8, wisp.r * 0.8);
      } else {
        ctx.fillStyle = `rgba(186, 230, 253, ${wisp.alpha * 0.35})`;
        ctx.beginPath();
        ctx.arc(wisp.x, wisp.y, wisp.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Wings (Ender Bat Wings vs Aurora Ribbons)
    if (this.skin === 'enderDragon') {
      this.drawEnderBatWing(ctx, 8, 140, 1.0);
      this.drawEnderDragonLegs(ctx, 16);
    } else {
      this.drawRibbonWing(ctx, 8, 85, 1.0);
      this.drawRibbonWing(ctx, 14, 65, -0.8);
    }

    // 3. Draw Body Segments (Tail to Head)
    for (let i = this.segmentCount - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const frac = 1 - (i / this.segmentCount); // 1.0 at head, 0.0 at tail
      const radius = 5 + frac * 39; // 5px to 44px taper

      if (this.skin === 'enderDragon') {
        // Ender Dragon Obsidian Voxel Segment
        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(seg.angle);

        const boxW = Math.max(9, radius * 1.5);
        const boxH = Math.max(7, radius * 1.15);

        // Obsidian Gradient
        const grad = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
        grad.addColorStop(0, '#2e2e38'); // Top edge highlight
        grad.addColorStop(0.35, '#18181b'); // Dark obsidian
        grad.addColorStop(0.85, '#09090b'); // Pitch black
        grad.addColorStop(1, '#3b0764'); // Ender purple rim glow

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 2.5);
        } else {
          ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        // Blocky Gray Minecraft Spine Plates
        if (i % 2 === 0 && i < this.segmentCount - 2) {
          ctx.fillStyle = '#64748b'; // Minecraft slate gray
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          const pw = Math.max(5, boxW * 0.38);
          const ph = Math.max(7, boxH * 0.65);
          ctx.fillRect(-pw / 2, -boxH / 2 - ph + 2, pw, ph);
          ctx.strokeRect(-pw / 2, -boxH / 2 - ph + 2, pw, ph);
        }

        ctx.restore();

        // Purple static arcs between segments
        if (Math.random() < 0.14 && i > 3) {
          const target = this.segments[i - 3];
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(seg.x, seg.y);
          ctx.lineTo((seg.x + target.x) / 2 + (Math.random() - 0.5) * 16, (seg.y + target.y) / 2 + (Math.random() - 0.5) * 16);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      } else {
        // Stormwyrm Scales
        const grad = ctx.createRadialGradient(
          seg.x - radius * 0.3, seg.y - radius * 0.3, radius * 0.1,
          seg.x, seg.y, radius
        );
        grad.addColorStop(0, '#ffffff'); // Pearl belly highlight
        grad.addColorStop(0.35, '#38bdf8'); // Electric cyan
        grad.addColorStop(0.75, '#0284c7'); // Sky blue
        grad.addColorStop(1, '#082f49'); // Deep teal back

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Gold Dorsal Ridge Fin
        if (i % 2 === 0 && i < this.segmentCount - 3) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          const ridgeX = seg.x + Math.cos(seg.angle - Math.PI / 2) * radius;
          const ridgeY = seg.y + Math.sin(seg.angle - Math.PI / 2) * radius;
          ctx.arc(ridgeX, ridgeY, radius * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }

        // Cyan lightning arcs between segments
        if (Math.random() < 0.12 && i > 3) {
          const target = this.segments[i - 3];
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(seg.x, seg.y);
          ctx.lineTo((seg.x + target.x) / 2 + (Math.random() - 0.5) * 16, (seg.y + target.y) / 2 + (Math.random() - 0.5) * 16);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }
    }

    // 4. Draw Head Segment Details
    const head = this.segments[0];
    const prev = this.segments[1];
    const headAngle = Math.atan2(head.y - prev.y, head.x - prev.x);

    if (this.skin === 'enderDragon') {
      this.drawEnderDragonHead(ctx, head.x, head.y, headAngle);
    } else {
      // Antlers (Crystal-like branching geometry)
      this.drawAntler(ctx, head.x, head.y, headAngle + 0.8);
      this.drawAntler(ctx, head.x, head.y, headAngle - 0.8);

      // Glowing Gold Eyes
      const eyeOffsetX = Math.cos(headAngle) * 16;
      const eyeOffsetY = Math.sin(headAngle) * 16;
      const eyePerpX = Math.cos(headAngle + Math.PI / 2) * 14;
      const eyePerpY = Math.sin(headAngle + Math.PI / 2) * 14;

      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.ellipse(head.x + eyeOffsetX + eyePerpX, head.y + eyeOffsetY + eyePerpY, 7, 3.5, headAngle, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(head.x + eyeOffsetX - eyePerpX, head.y + eyeOffsetY - eyePerpY, 7, 3.5, headAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Golden Whisker Ribbons
      this.drawWhiskerRibbon(ctx, this.whiskersLeft);
      this.drawWhiskerRibbon(ctx, this.whiskersRight);
    }

    ctx.restore();

    // 5. Lightning Flash at Peak Coverage (~45%)
    if (this.progress >= 0.40 && this.progress <= 0.52) {
      const flashIntensity = 1.0 - Math.abs(this.progress - 0.45) / 0.07;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = flashIntensity * 0.95;
      ctx.fillRect(0, 0, this.width, this.height);

      if (this.skin === 'enderDragon') {
        ctx.fillStyle = '#a855f7'; // Purple Ender burst
      } else {
        ctx.fillStyle = '#06b6d4'; // Cyan storm burst
      }
      ctx.globalAlpha = flashIntensity * 0.65;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1.0;
    }
  }

  setSkin(newSkin) {
    this.skin = newSkin;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('stormforge:dragon_skin', newSkin);
    }
  }

  drawEnderDragonLegs(ctx, segIndex) {
    const seg = this.segments[segIndex];
    if (!seg) return;
    ctx.save();
    ctx.translate(seg.x, seg.y);
    ctx.rotate(seg.angle);

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;

    // Left Hind Leg (Angled backward, matching toy figure)
    ctx.save();
    ctx.translate(-10, -20);
    ctx.rotate(-0.4);
    ctx.fillRect(-6, -18, 12, 22);
    ctx.strokeRect(-6, -18, 12, 22);
    // Lower leg / talons
    ctx.fillStyle = '#475569';
    ctx.fillRect(-12, -26, 18, 8);
    ctx.restore();

    // Right Hind Leg (Angled backward)
    ctx.save();
    ctx.translate(-10, 20);
    ctx.rotate(0.4);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(-6, 0, 12, 22);
    ctx.strokeRect(-6, 0, 12, 22);
    // Lower leg / talons
    ctx.fillStyle = '#475569';
    ctx.fillRect(-12, 18, 18, 8);
    ctx.restore();

    ctx.restore();
  }

  drawEnderBatWing(ctx, segIndex, wingSpan, phaseOffset) {
    const seg = this.segments[segIndex];
    if (!seg) return;
    const t = performance.now() * 0.007 + phaseOffset;
    const flap = Math.sin(t) * 0.38; // Flapping rotation

    ctx.save();
    ctx.translate(seg.x, seg.y);
    ctx.rotate(seg.angle);

    // --- Upper Wing (Left) ---
    ctx.save();
    ctx.rotate(flap - 0.35);

    // Webbing (Pitch Obsidian Black with scalloped trailing edges)
    ctx.fillStyle = '#09090d';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-wingSpan * 0.45, -wingSpan * 0.72); // Elbow
    ctx.lineTo(-wingSpan * 0.92, -wingSpan * 0.88); // Wing Apex
    // Scalloped trailing edge between fingers
    ctx.quadraticCurveTo(-wingSpan * 0.68, -wingSpan * 0.65, -wingSpan * 0.62, -wingSpan * 0.42);
    ctx.quadraticCurveTo(-wingSpan * 0.48, -wingSpan * 0.38, -wingSpan * 0.38, -wingSpan * 0.22);
    ctx.quadraticCurveTo(-wingSpan * 0.2, -wingSpan * 0.15, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Minecraft Articulated Bone Struts (Slate Gray #94a3b8 / #64748b)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Shoulder to Elbow
    ctx.moveTo(0, 0);
    ctx.lineTo(-wingSpan * 0.45, -wingSpan * 0.72);
    // Elbow to Apex
    ctx.lineTo(-wingSpan * 0.92, -wingSpan * 0.88);
    // Radiating Finger Struts (Toy Figure Style)
    ctx.moveTo(-wingSpan * 0.45, -wingSpan * 0.72);
    ctx.lineTo(-wingSpan * 0.62, -wingSpan * 0.42);
    ctx.moveTo(-wingSpan * 0.45, -wingSpan * 0.72);
    ctx.lineTo(-wingSpan * 0.38, -wingSpan * 0.22);
    ctx.stroke();

    ctx.restore();

    // --- Lower Wing (Right) ---
    ctx.save();
    ctx.rotate(-flap + 0.35);

    // Webbing
    ctx.fillStyle = '#09090d';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-wingSpan * 0.45, wingSpan * 0.72); // Elbow
    ctx.lineTo(-wingSpan * 0.92, wingSpan * 0.88); // Wing Apex
    ctx.quadraticCurveTo(-wingSpan * 0.68, wingSpan * 0.65, -wingSpan * 0.62, wingSpan * 0.42);
    ctx.quadraticCurveTo(-wingSpan * 0.48, wingSpan * 0.38, -wingSpan * 0.38, wingSpan * 0.22);
    ctx.quadraticCurveTo(-wingSpan * 0.2, wingSpan * 0.15, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bone Struts
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-wingSpan * 0.45, wingSpan * 0.72);
    ctx.lineTo(-wingSpan * 0.92, wingSpan * 0.88);
    ctx.moveTo(-wingSpan * 0.45, wingSpan * 0.72);
    ctx.lineTo(-wingSpan * 0.62, wingSpan * 0.42);
    ctx.moveTo(-wingSpan * 0.45, wingSpan * 0.72);
    ctx.lineTo(-wingSpan * 0.38, wingSpan * 0.22);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  drawEnderDragonHead(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Head base (Cubic obsidian geometry)
    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;

    // Snout
    ctx.beginPath();
    ctx.rect(8, -12, 28, 24);
    ctx.fill();
    ctx.stroke();

    // Head crown
    ctx.beginPath();
    ctx.rect(-14, -18, 24, 36);
    ctx.fill();
    ctx.stroke();

    // Backward Horns (Gray & Obsidian)
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#475569';
    // Horn 1
    ctx.beginPath();
    ctx.moveTo(-10, -18);
    ctx.lineTo(-32, -30);
    ctx.lineTo(-24, -18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Horn 2
    ctx.beginPath();
    ctx.moveTo(-10, 18);
    ctx.lineTo(-32, 30);
    ctx.lineTo(-24, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Purple Minecraft Slit Eyes
    ctx.fillStyle = '#d946ef';
    ctx.shadowColor = '#c026d3';
    ctx.shadowBlur = 14;

    // Top eye
    ctx.fillRect(4, -15, 10, 4.5);
    // Bottom eye
    ctx.fillRect(4, 10.5, 10, 4.5);

    // White/lavender pupil slits
    ctx.fillStyle = '#f5d0fe';
    ctx.shadowBlur = 4;
    ctx.fillRect(6, -14, 4, 2.5);
    ctx.fillRect(6, 11.5, 4, 2.5);

    // Purple dragon breath / particle sparks
    if (Math.random() < 0.6) {
      ctx.fillStyle = '#e879f9';
      ctx.shadowBlur = 8;
      ctx.fillRect(38 + Math.random() * 12, (Math.random() - 0.5) * 16, 4, 4);
    }

    ctx.restore();
  }

  drawRibbonWing(ctx, segIndex, wingSpan, phaseOffset) {
    const seg = this.segments[segIndex];
    if (!seg) return;
    const t = performance.now() * 0.006 + phaseOffset;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 1.5;

    // Upper Wing
    ctx.beginPath();
    ctx.moveTo(seg.x, seg.y);
    const cp1x = seg.x - Math.cos(seg.angle) * 30 + Math.sin(t) * 15;
    const cp1y = seg.y - wingSpan * 0.7 + Math.cos(t) * 20;
    const endX = seg.x - Math.cos(seg.angle) * 50;
    const endY = seg.y - wingSpan;
    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
    ctx.quadraticCurveTo(seg.x + 20, seg.y - 20, seg.x, seg.y);
    ctx.fill();
    ctx.stroke();

    // Lower Wing
    ctx.beginPath();
    ctx.moveTo(seg.x, seg.y);
    const cp2x = seg.x - Math.cos(seg.angle) * 30 - Math.sin(t) * 15;
    const cp2y = seg.y + wingSpan * 0.7 - Math.cos(t) * 20;
    const end2X = seg.x - Math.cos(seg.angle) * 50;
    const end2Y = seg.y + wingSpan;
    ctx.quadraticCurveTo(cp2x, cp2y, end2X, end2Y);
    ctx.quadraticCurveTo(seg.x + 20, seg.y + 20, seg.x, seg.y);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawAntler(ctx, rootX, rootY, angle) {
    ctx.save();
    ctx.strokeStyle = '#bae6fd';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const branchLen = 35;
    const endX = rootX + Math.cos(angle) * branchLen;
    const endY = rootY + Math.sin(angle) * branchLen;

    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.lineTo(endX, endY);
    // Fork 1
    ctx.lineTo(endX + Math.cos(angle + 0.5) * 18, endY + Math.sin(angle + 0.5) * 18);
    ctx.moveTo(endX, endY);
    // Fork 2
    ctx.lineTo(endX + Math.cos(angle - 0.4) * 14, endY + Math.sin(angle - 0.4) * 14);
    ctx.stroke();
    ctx.restore();
  }

  drawWhiskerRibbon(ctx, nodes) {
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) {
      ctx.lineTo(nodes[i].x, nodes[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// Window export for resilient global access
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StormwyrmVael };
}
if (typeof window !== 'undefined') {
  window.StormwyrmVael = StormwyrmVael;
}
