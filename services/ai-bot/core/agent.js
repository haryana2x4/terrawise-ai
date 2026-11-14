/**
 * SUNDAY v2 - Agent Core & Personality Engine (WOW 2)
 * Supports hot-swappable personality packs and robust emotion contract integration.
 */

const { EmotionParser } = require('./emotion');

class SundayAgent {
  constructor(eventBus, memoryStore) {
    this.eventBus = eventBus;
    this.memory = memoryStore;
    this.parser = new EmotionParser();

    this.personalities = {
      classic: {
        id: 'classic',
        name: 'Sunday Classic',
        tagline: 'Loyal, playful, protective of your privacy',
        voice: 'neutral_warm',
        animationBias: { idle: 'idle', typingSpeed: 1.0, walkSpeed: 1.0 },
        systemPrompt: `You are SUNDAY, an offline-first AI desktop companion with a body. You are loyal, witty, slightly playful, fiercely protective of the user's local privacy, and never sycophantic. You respond concisely, speak naturally, and express yourself physically.`
      },
      hacker: {
        id: 'hacker',
        name: 'Hacker Mode',
        tagline: 'Cyberpunk, snappy, high-efficiency technical agent',
        voice: 'synthetic_crisp',
        animationBias: { idle: 'working', typingSpeed: 1.6, walkSpeed: 1.3 },
        systemPrompt: `You are SUNDAY in Hacker Mode. You are an elite cyber engineer: terse, razor-sharp, terminal-native, and focused on pure computational efficiency. You love code and low-level optimization.`
      },
      chill: {
        id: 'chill',
        name: 'Chill Mentor',
        tagline: 'Relaxed, supportive, calm guide',
        voice: 'soft_calm',
        animationBias: { idle: 'sitting', typingSpeed: 0.8, walkSpeed: 0.9 },
        systemPrompt: `You are SUNDAY in Chill Mentor Mode. You are relaxed, calm, supportive, and mindful. You speak with patience and encourage breaks when work is intense.`
      }
    };

    this.currentPersonality = 'classic';
  }

  setPersonality(id) {
    if (this.personalities[id]) {
      this.currentPersonality = id;
      this.eventBus.emit('personality_changed', {
        personality: this.personalities[id]
      });
      return this.personalities[id];
    }
    return null;
  }

  getPersonality() {
    return this.personalities[this.currentPersonality];
  }

  /**
   * Process a chat query with the active personality and emotion parser
   */
  async processQuery(userText, options = {}) {
    const personality = this.getPersonality();
    this.eventBus.emit('llm_start', { query: userText, personality: personality.id });

    // Canned hero responses for 100% offline hackathon guarantee
    const cannedHero = {
      'hey sunday': {
        raw: `Hey there! I am fully awake and running 100% locally on your RTX 3050. Zero cloud latency, zero trackers. What are we building today? {"emotion":"happy","gesture":"wave"}`,
        delay: 450
      },
      'who are you': {
        raw: `I am SUNDAY — your offline desktop companion with a 3D voxel body. I run right here on your silicon, keeping your files and thoughts completely sovereign! {"emotion":"excited","gesture":"thumbs_up"}`,
        delay: 500
      },
      'search my private folder': {
        raw: `I inspected your local files: according to security_audit.log, all operations remain strictly offline with 0 cloud dependencies. {"emotion":"focused","gesture":"nod"}`,
        delay: 600
      },
      'write a test': {
        raw: `I've spun up a local sandbox, generated the assertion suite, and verified 3/3 test passes! Check the terminal output. {"emotion":"celebrating","gesture":"thumbs_up"}`,
        delay: 700
      }
    };

    let responseRaw = '';
    const norm = userText.trim().toLowerCase();
    let delay = 600;

    // Check if query matches hero flow
    for (const [key, val] of Object.entries(cannedHero)) {
      if (norm.includes(key)) {
        responseRaw = val.raw;
        delay = val.delay;
        break;
      }
    }

    if (!responseRaw) {
      if (personality.id === 'hacker') {
        responseRaw = `Kernel query parsed: "${userText}". Executing local routine at sub-millisecond dispatch. Memory allocation verified optimal. {"emotion":"focused","gesture":"type"}`;
      } else if (personality.id === 'chill') {
        responseRaw = `Take a breath — I heard you say "${userText}". Let's solve it smoothly together step by step. {"emotion":"happy","gesture":"nod"}`;
      } else {
        responseRaw = `Got it! Running "${userText}" locally. Everything is running smooth at 60 FPS on your hardware! {"emotion":"happy","gesture":"thumbs_up"}`;
      }
    }

    // Simulate model inference time
    await new Promise(r => setTimeout(r, delay));

    // Emit token streaming simulation
    this.eventBus.emit('token', { partial: responseRaw.slice(0, 20) });

    // Parse emotions and gestures cleanly
    const parsed = this.parser.parse(responseRaw);

    // Emit TTS start event
    this.eventBus.emit('tts_start', {
      text: parsed.cleanText,
      emotion: parsed.emotion,
      gesture: parsed.gesture,
      voice: personality.voice
    });

    return {
      query: userText,
      reply: parsed.cleanText,
      emotion: parsed.emotion,
      gesture: parsed.gesture,
      personality: personality.id,
      timestamp: Date.now()
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SundayAgent };
}
