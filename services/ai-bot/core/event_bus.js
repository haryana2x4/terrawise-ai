/**
 * SUNDAY v2 - Unified Event Bus & State Machine
 * Single source of truth driving the 3D Avatar, UI reactive lighting, and assistant life cycle.
 */

class SundayEventBus {
  constructor() {
    this.listeners = new Map();
    // Valid states
    this.states = [
      'sleeping',
      'waking',
      'idle',
      'listening',
      'thinking',
      'talking',
      'working',
      'celebrating',
      'confused',
      'error'
    ];
    this.currentState = 'idle';
    this.stateHistory = [];
    this.idleTimer = null;
    this.idleTimeoutMs = 45000; // Sleep after 45s of silence
    this.resetIdleTimer();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  emit(event, data = {}) {
    const timestamp = Date.now();
    const payload = { event, data, timestamp, currentState: this.currentState };

    // Update state machine if the event dictates a state transition
    this.handleEventTransition(event, data);

    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(payload); } catch (err) { console.error(`[EventBus] Error in ${event} listener:`, err); }
      });
    }

    // Always emit wildcard for telemetry/observers
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => {
        try { cb(payload); } catch (err) { console.error(`[EventBus] Error in wildcard listener:`, err); }
      });
    }
  }

  handleEventTransition(event, data) {
    let nextState = this.currentState;

    switch (event) {
      case 'wake':
      case 'wake_word_detected':
        nextState = 'waking';
        setTimeout(() => this.setState('listening'), 600);
        break;

      case 'mic_open':
      case 'stt_start':
        nextState = 'listening';
        break;

      case 'stt_partial':
        if (this.currentState !== 'listening') nextState = 'listening';
        break;

      case 'llm_start':
      case 'stt_final':
        nextState = 'thinking';
        break;

      case 'token':
      case 'tts_start':
      case 'speak_start':
        nextState = 'talking';
        break;

      case 'speak_end':
      case 'tts_end':
        nextState = 'idle';
        break;

      case 'tool_start':
        nextState = 'working';
        break;

      case 'tool_success':
        nextState = 'celebrating';
        setTimeout(() => {
          if (this.currentState === 'celebrating') this.setState('idle');
        }, 3200);
        break;

      case 'tool_error':
      case 'error':
        nextState = 'error';
        setTimeout(() => {
          if (this.currentState === 'error') this.setState('idle');
        }, 3000);
        break;

      case 'idle_timeout':
        nextState = 'sleeping';
        break;

      case 'reset_to_idle':
        nextState = 'idle';
        break;
    }

    if (nextState !== this.currentState) {
      this.setState(nextState, { reason: event, ...data });
    } else {
      this.resetIdleTimer();
    }
  }

  setState(newState, meta = {}) {
    if (!this.states.includes(newState)) {
      console.warn(`[EventBus] Invalid state requested: ${newState}`);
      return;
    }

    const previousState = this.currentState;
    this.currentState = newState;
    this.stateHistory.push({ from: previousState, to: newState, time: Date.now() });
    if (this.stateHistory.length > 50) this.stateHistory.shift();

    this.resetIdleTimer();

    // Notify state change subscribers
    const statePayload = { previousState, currentState: newState, meta, timestamp: Date.now() };
    if (this.listeners.has('state_changed')) {
      this.listeners.get('state_changed').forEach(cb => {
        try { cb(statePayload); } catch (err) { console.error('[EventBus] state_changed error:', err); }
      });
    }
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.currentState !== 'sleeping') {
      this.idleTimer = setTimeout(() => {
        this.emit('idle_timeout', { message: 'Inactivity threshold reached' });
      }, this.idleTimeoutMs);
    }
  }

  getState() {
    return this.currentState;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SundayEventBus };
}
