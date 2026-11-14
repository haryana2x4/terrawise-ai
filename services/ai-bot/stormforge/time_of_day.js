/**
 * STORMFORGE SKY-CITADEL: Time-of-Day Engine
 * Reads user's local system clock, sets CSS palette variables, and cross-fades over 3s.
 */

class TimeOfDayEngine {
  constructor() {
    this.currentPeriod = null;
    this.init();
  }

  init() {
    this.updatePeriod();
    // Check every 60 seconds for transitions
    setInterval(() => this.updatePeriod(), 60000);
  }

  getPeriodForHour(hour) {
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 17) return 'day';
    if (hour >= 17 && hour < 20) return 'dusk';
    return 'night';
  }

  updatePeriod(override = null) {
    const hour = new Date().getHours();
    const period = override || this.getPeriodForHour(hour);

    if (this.currentPeriod === period) return;
    this.currentPeriod = period;

    document.documentElement.setAttribute('data-time-of-day', period);

    // Palettes
    const palettes = {
      dawn: {
        '--sky-top': '#12182b',
        '--sky-mid': '#2a2842',
        '--sky-bot': '#e07a5f',
        '--rune-glow': 'rgba(245, 158, 11, 0.4)',
        '--aurora-opacity': '0.15'
      },
      day: {
        '--sky-top': '#0b192c',
        '--sky-mid': '#1e3e62',
        '--sky-bot': '#000000',
        '--rune-glow': 'rgba(6, 182, 212, 0.35)',
        '--aurora-opacity': '0.1'
      },
      dusk: {
        '--sky-top': '#13111c',
        '--sky-mid': '#2c1e38',
        '--sky-bot': '#c2410c',
        '--rune-glow': 'rgba(236, 72, 153, 0.45)',
        '--aurora-opacity': '0.3'
      },
      night: {
        '--sky-top': '#030509',
        '--sky-mid': '#060d1a',
        '--sky-bot': '#020305',
        '--rune-glow': 'rgba(6, 182, 212, 0.65)',
        '--aurora-opacity': '0.75'
      }
    };

    const p = palettes[period];
    for (const [k, v] of Object.entries(p)) {
      document.documentElement.style.setProperty(k, v);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimeOfDayEngine };
}
if (typeof window !== 'undefined') {
  window.TimeOfDayEngine = TimeOfDayEngine;
}

