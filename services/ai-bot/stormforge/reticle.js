/**
 * STORMFORGE SKY-CITADEL: Targeting Reticle System
 * Gold corner brackets that smoothly snap to hovered interactive elements with soft audio tick.
 * Feeds reticle coordinate to Hero gaze tracking.
 */

class TargetingReticle {
  constructor(audioBed = null) {
    this.audio = audioBed;
    this.targetEl = null;
    this.visible = false;

    // Smoothed coordinates
    this.x = 0;
    this.y = 0;
    this.w = 0;
    this.h = 0;

    // Target coordinates
    this.targetX = 0;
    this.targetY = 0;
    this.targetW = 0;
    this.targetH = 0;

    this.padding = 6;
    this.dom = null;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.dom = document.createElement('div');
    this.dom.id = 'targeting-reticle';
    this.dom.className = 'targeting-reticle';
    this.dom.innerHTML = `
      <div class="reticle-corner tl"></div>
      <div class="reticle-corner tr"></div>
      <div class="reticle-corner bl"></div>
      <div class="reticle-corner br"></div>
    `;
    this.dom.style.position = 'fixed';
    this.dom.style.pointerEvents = 'none';
    this.dom.style.zIndex = '9990';
    this.dom.style.transition = 'opacity 0.2s ease';
    this.dom.style.opacity = '0';
    this.dom.style.boxSizing = 'border-box';

    document.body.appendChild(this.dom);
  }

  bindEvents() {
    const selector = 'button, a, input, textarea, select, .nav-tab, .card, .tool-card, .metric-card, .chat-chip';

    document.addEventListener('mouseover', (e) => {
      const match = e.target.closest(selector);
      if (match && match !== this.targetEl) {
        this.targetEl = match;
        this.visible = true;
        this.updateTargetBounds();
        this.dom.style.opacity = '1';
        if (this.audio) this.audio.playTick();

        // Feed to Hero gaze tracking
        window.dispatchEvent(new CustomEvent('hero:gaze', {
          detail: { x: this.targetX + this.targetW / 2, y: this.targetY + this.targetH / 2 }
        }));
      }
    });

    document.addEventListener('mouseout', (e) => {
      const match = e.target.closest(selector);
      if (match && match === this.targetEl) {
        this.targetEl = null;
        this.visible = false;
        this.dom.style.opacity = '0';
      }
    });

    window.addEventListener('scroll', () => {
      if (this.visible && this.targetEl) {
        this.updateTargetBounds();
      }
    }, { passive: true });
  }

  updateTargetBounds() {
    if (!this.targetEl) return;
    const rect = this.targetEl.getBoundingClientRect();
    this.targetX = rect.left - this.padding;
    this.targetY = rect.top - this.padding;
    this.targetW = rect.width + this.padding * 2;
    this.targetH = rect.height + this.padding * 2;

    // If snapping for the first time, snap immediately
    if (this.w === 0 && this.h === 0) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.w = this.targetW;
      this.h = this.targetH;
    }
  }

  update(delta) {
    if (!this.visible) return;

    // Smooth lerp
    const lerpSpeed = Math.min(1.0, delta * 18);
    this.x += (this.targetX - this.x) * lerpSpeed;
    this.y += (this.targetY - this.y) * lerpSpeed;
    this.w += (this.targetW - this.w) * lerpSpeed;
    this.h += (this.targetH - this.h) * lerpSpeed;

    this.dom.style.left = `${this.x}px`;
    this.dom.style.top = `${this.y}px`;
    this.dom.style.width = `${this.w}px`;
    this.dom.style.height = `${this.h}px`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TargetingReticle };
}
if (typeof window !== 'undefined') {
  window.TargetingReticle = TargetingReticle;
}
