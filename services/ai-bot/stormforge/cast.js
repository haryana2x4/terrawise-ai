/**
 * STORMFORGE SKY-CITADEL: Master Cast Director & Spectacle Scheduler
 * Coordinates Captain Skybolt, Stormwyrm Vael, and Flicker Spirit.
 * Enforces strict priority hierarchy, suppression rules, status reactions,
 * Konami code easter egg, power meter charging, and floating cast panel.
 */

class CastDirector {
  constructor(options = {}) {
    this.weather = options.weather || null;
    this.audio = options.audio || null;
    this.vael = options.vael || null;
    this.flicker = options.flicker || null;
    this.reticle = options.reticle || null;
    this.skyboltRig = options.skyboltRig || null;
    this.skyboltAnim = options.skyboltAnim || null;

    // Director State
    this.lastUserActionTime = performance.now();
    this.isTyping = false;
    this.isModalOpen = false;
    this.isBlurred = false;
    this.idleAnticActive = false;
    this.lastClickTime = 0;

    // Power Meter
    this.power = 0; // 0 to 100%
    this.powerDecayRate = 1.5; // % per sec
    this.isBurstActive = false;

    // FPS Monitor for Auto Quality Dropping
    this.fpsHistory = [];
    this.lastFpsCheck = performance.now();
    this.currentQuality = localStorage.getItem('stormforge:quality') || 'high';

    // Konami Code Buffer
    this.konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    this.konamiIdx = 0;

    this.initSuppressionWatchers();
    this.initStatusReactions();
    this.initPowerMeterUI();
    this.initKonamiListener();
    this.initCastPanelUI();
  }

  initSuppressionWatchers() {
    // 1. User Typing Suppression
    document.addEventListener('focusin', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
        this.isTyping = true;
      }
    });

    document.addEventListener('focusout', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
        this.isTyping = false;
        this.lastUserActionTime = performance.now();
      }
    });

    // 2. Click tracking & power charge
    window.addEventListener('click', () => {
      this.lastClickTime = performance.now();
      this.lastUserActionTime = performance.now();
      this.chargePower(5);
    });

    // 3. Keystroke tracking & power charge
    window.addEventListener('keydown', () => {
      this.lastUserActionTime = performance.now();
      this.chargePower(2);
    });

    // 4. Tab Blur / Visibility
    document.addEventListener('visibilitychange', () => {
      this.isBlurred = document.hidden;
    });
    window.addEventListener('blur', () => { this.isBlurred = true; });
    window.addEventListener('focus', () => { this.isBlurred = false; });
  }

  chargePower(amount) {
    if (this.isBurstActive) return;
    this.power = Math.min(100, this.power + amount);
    this.updatePowerMeterUI();

    if (this.power >= 100) {
      this.triggerSkyboltBurst();
    }
  }

  triggerSkyboltBurst() {
    this.isBurstActive = true;
    this.power = 100;
    this.updatePowerMeterUI();

    if (this.audio) this.audio.playLaser();
    if (this.weather) this.weather.spikeStorm(0.7);

    // Flash power bar gold
    const bar = document.getElementById('cast-power-fill');
    if (bar) bar.style.boxShadow = '0 0 20px #fbbf24, 0 0 40px #fbbf24';

    // Hero gesture & card pulse
    const heroPill = document.getElementById('nav-state-label');
    if (heroPill) heroPill.textContent = 'SKYBOLT BURST!';

    const cards = document.querySelectorAll('.card, .glass-card, .tool-card');
    cards.forEach((c) => {
      c.classList.add('burst-pulse');
      setTimeout(() => c.classList.remove('burst-pulse'), 1200);
    });

    setTimeout(() => {
      this.power = 0;
      this.isBurstActive = false;
      this.updatePowerMeterUI();
      if (bar) bar.style.boxShadow = '';
      if (heroPill && heroPill.textContent === 'SKYBOLT BURST!') heroPill.textContent = 'IDLE';
    }, 2800);
  }

  initStatusReactions() {
    window.addEventListener('hero:success', (e) => {
      this.onHeroStatus('SUCCESS', '#10b981', e.detail);
    });

    window.addEventListener('hero:error', (e) => {
      this.onHeroStatus('ERROR', '#ef4444', e.detail);
    });

    window.addEventListener('hero:loading', (e) => {
      this.onHeroStatus('COMPUTING', '#38bdf8', e.detail);
    });
  }

  onHeroStatus(label, color, detail = {}) {
    const heroPill = document.getElementById('nav-state-label');
    const heroDot = document.getElementById('nav-state-dot');
    if (heroPill) heroPill.textContent = label;
    if (heroDot) heroDot.style.background = color;

    if (label === 'SUCCESS' && this.skyboltAnim) {
      this.skyboltAnim.play('dance');
      setTimeout(() => {
        if (heroPill && heroPill.textContent === 'SUCCESS') heroPill.textContent = 'IDLE';
        if (heroDot) heroDot.style.background = '#10b981';
        if (this.skyboltAnim) this.skyboltAnim.play('idle');
      }, 2500);
    } else if (label === 'ERROR' && this.skyboltAnim) {
      this.skyboltAnim.play('sad');
      setTimeout(() => {
        if (heroPill && heroPill.textContent === 'ERROR') heroPill.textContent = 'IDLE';
        if (heroDot) heroDot.style.background = '#10b981';
        if (this.skyboltAnim) this.skyboltAnim.play('idle');
      }, 2500);
    }
  }

  initKonamiListener() {
    window.addEventListener('keydown', (e) => {
      const expectedKey = this.konamiCode[this.konamiIdx];
      if (e.key.toLowerCase() === expectedKey.toLowerCase()) {
        this.konamiIdx++;
        if (this.konamiIdx === this.konamiCode.length) {
          this.konamiIdx = 0;
          this.triggerKonamiEasterEgg();
        }
      } else {
        this.konamiIdx = 0;
      }
    });
  }

  triggerKonamiEasterEgg() {
    if (this.vael) {
      const heroPill = document.getElementById('nav-state-label');
      if (heroPill) heroPill.textContent = 'RIDING VAEL!';

      this.vael.playTransition({
        variant: 'loopTheLoop',
        direction: 1
      }).then(() => {
        if (heroPill && heroPill.textContent === 'RIDING VAEL!') heroPill.textContent = 'IDLE';
      });

      if (this.audio) this.audio.playThunderRoar();
    }
  }

  initPowerMeterUI() {
    const meter = document.createElement('div');
    meter.id = 'cast-power-meter';
    meter.className = 'cast-power-meter';
    meter.innerHTML = `
      <div class="power-meter-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>BURST CHARGE</span>
        <span id="cast-power-val" style="margin-left:auto; font-weight:700;">0%</span>
      </div>
      <div class="power-track">
        <div id="cast-power-fill" class="power-fill"></div>
      </div>
    `;
    document.body.appendChild(meter);
  }

  updatePowerMeterUI() {
    const fill = document.getElementById('cast-power-fill');
    const val = document.getElementById('cast-power-val');
    if (fill) fill.style.width = `${this.power.toFixed(0)}%`;
    if (val) val.textContent = `${this.power.toFixed(0)}%`;
  }

  initCastPanelUI() {
    // Floating Gear Button (Bottom Right)
    const btn = document.createElement('button');
    btn.id = 'cast-panel-toggle';
    btn.className = 'cast-panel-toggle';
    btn.setAttribute('aria-label', 'Stormforge Cast Controls');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    `;

    // Cast Control Panel Modal / Sheet
    const panel = document.createElement('div');
    panel.id = 'cast-panel-modal';
    panel.className = 'cast-panel-modal';
    panel.innerHTML = `
      <div class="cast-panel-header">
        <div style="font-weight:700; font-size:13px; display:flex; align-items:center; gap:6px;">
          <span style="color:#06b6d4;">✦</span> STORMFORGE CAST DIRECTOR
        </div>
        <button id="cast-panel-close" style="background:transparent; border:none; color:#94a3b8; cursor:pointer;">✕</button>
      </div>

      <div class="cast-panel-body">
        <div class="cast-option-row">
          <span>Captain Skybolt</span>
          <input type="checkbox" id="toggle-hero" checked>
        </div>
        <div class="cast-option-row">
          <span>Stormwyrm Vael</span>
          <input type="checkbox" id="toggle-vael" checked>
        </div>
        <div class="cast-option-row">
          <span>Flicker Spirit</span>
          <input type="checkbox" id="toggle-flicker" checked>
        </div>
        <div class="cast-option-row">
          <span>Procedural Audio</span>
          <input type="checkbox" id="toggle-audio">
        </div>
        <div class="cast-option-row">
          <span>Targeting Reticle</span>
          <input type="checkbox" id="toggle-reticle" checked>
        </div>

        <div style="margin-top:10px; font-size:11px; color:#94a3b8; font-weight:600;">RENDERING QUALITY</div>
        <div class="quality-selector-group">
          <button class="quality-btn" data-q="low">Low</button>
          <button class="quality-btn" data-q="med">Med</button>
          <button class="quality-btn active" data-q="high">High</button>
        </div>

        <div style="margin-top:10px; font-size:11px; color:#94a3b8; font-weight:600;">TIME OF DAY OVERRIDE</div>
        <div class="tod-selector-group">
          <button class="tod-btn active" data-tod="auto">Auto</button>
          <button class="tod-btn" data-tod="dawn">Dawn</button>
          <button class="tod-btn" data-tod="day">Day</button>
          <button class="tod-btn" data-tod="dusk">Dusk</button>
          <button class="tod-btn" data-tod="night">Night</button>
        </div>

        <div class="sightings-badge-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>Flicker Sightings:</span>
          <span id="cast-sightings-count" style="font-weight:700; color:#38bdf8;">0</span>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // Event handlers
    btn.addEventListener('click', () => {
      panel.classList.toggle('open');
      this.isModalOpen = panel.classList.contains('open');
    });

    panel.querySelector('#cast-panel-close').addEventListener('click', () => {
      panel.classList.remove('open');
      this.isModalOpen = false;
    });

    // Checkboxes
    panel.querySelector('#toggle-hero').addEventListener('change', (e) => {
      const el = document.getElementById('three-canvas');
      if (el) el.style.display = e.target.checked ? 'block' : 'none';
    });

    panel.querySelector('#toggle-vael').addEventListener('change', (e) => {
      if (this.vael) this.vael.active = e.target.checked;
    });

    panel.querySelector('#toggle-flicker').addEventListener('change', (e) => {
      if (this.flicker) this.flicker.active = e.target.checked;
    });

    panel.querySelector('#toggle-audio').addEventListener('change', (e) => {
      if (this.audio) this.audio.toggleMute(!e.target.checked);
    });

    panel.querySelector('#toggle-reticle').addEventListener('change', (e) => {
      const r = document.getElementById('targeting-reticle');
      if (r) r.style.display = e.target.checked ? 'block' : 'none';
    });

    // Quality buttons
    panel.querySelectorAll('.quality-btn').forEach((b) => {
      b.addEventListener('click', () => {
        panel.querySelectorAll('.quality-btn').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        this.setQuality(b.getAttribute('data-q'));
      });
    });

    // Time of day buttons
    panel.querySelectorAll('.tod-btn').forEach((b) => {
      b.addEventListener('click', () => {
        panel.querySelectorAll('.tod-btn').forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        const mode = b.getAttribute('data-tod');
        if (window.StormforgeTime) {
          window.StormforgeTime.updatePeriod(mode === 'auto' ? null : mode);
        }
      });
    });

    // Initialize sightings count
    const sightingsEl = panel.querySelector('#cast-sightings-count');
    if (sightingsEl && this.flicker) {
      sightingsEl.textContent = this.flicker.sightings;
    }
  }

  setQuality(q) {
    this.currentQuality = q;
    localStorage.setItem('stormforge:quality', q);

    if (q === 'low') {
      if (this.flicker) this.flicker.active = false;
      if (this.weather) this.weather.stormIntensity = 0;
    } else if (q === 'med') {
      if (this.flicker) this.flicker.active = true;
    } else if (q === 'high') {
      if (this.flicker) this.flicker.active = true;
    }
  }

  update(delta) {
    const now = performance.now();

    // Power decay
    if (this.power > 0 && !this.isBurstActive) {
      this.power = Math.max(0, this.power - delta * this.powerDecayRate);
      this.updatePowerMeterUI();
    }

    // Reticle update
    if (this.reticle) {
      this.reticle.update(delta);
    }

    // Idle antics trigger after 60s without input
    if (now - this.lastUserActionTime > 60000 && !this.idleAnticActive && !this.isTyping && !this.isModalOpen && !this.isBlurred) {
      this.triggerIdleAntic();
    }

    // Auto-downgrade quality if FPS < 45 for 2s
    if (now - this.lastFpsCheck >= 2000) {
      this.checkFpsHealth();
      this.lastFpsCheck = now;
    }
  }

  triggerIdleAntic() {
    this.idleAnticActive = true;
    const heroPill = document.getElementById('nav-state-label');
    if (heroPill) heroPill.textContent = 'YAWNING...';
    if (this.skyboltAnim) this.skyboltAnim.play('idle');

    setTimeout(() => {
      this.idleAnticActive = false;
      if (heroPill && heroPill.textContent === 'YAWNING...') heroPill.textContent = 'IDLE';
    }, 4000);
  }

  checkFpsHealth() {
    const fpsText = document.getElementById('hud-fps');
    if (fpsText) {
      const currentFps = parseFloat(fpsText.textContent) || 60;
      if (currentFps < 45 && this.currentQuality !== 'low') {
        console.warn(`Low FPS detected (${currentFps}). Auto-dropping quality to low.`);
        this.setQuality('low');
        const lowBtn = document.querySelector('.quality-btn[data-q="low"]');
        if (lowBtn) {
          document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
          lowBtn.classList.add('active');
        }
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CastDirector };
}
if (typeof window !== 'undefined') {
  window.CastDirector = CastDirector;
}
