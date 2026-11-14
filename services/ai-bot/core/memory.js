/**
 * SUNDAY v2 - Memory & Fact Persistence Engine
 * Stores user preferences, identity, and context across restarts.
 * Provides instant serialization to persistent storage.
 */

const fs = require('fs');
const path = require('path');

class MemoryStore {
  constructor(storagePath) {
    this.filePath = storagePath || path.join(__dirname, '..', 'data', 'memory.json');
    this.memory = {
      user: {
        name: 'Aryan',
        title: 'Lead Architect',
        focus: 'AI & Hackathon Systems',
        preferredVoice: 'warm_energetic'
      },
      facts: [
        { id: 1, text: 'Competes in high-stakes hackathons with offline-first AI models.', timestamp: '2026-11-01' },
        { id: 2, text: 'Prefers local-first execution with zero cloud telemetry for privacy.', timestamp: '2026-11-02' },
        { id: 3, text: 'Working on Sunday v2: The Living Companion with 3D Voxel Rig.', timestamp: '2026-11-02' }
      ],
      preferences: {
        companionAlwaysOnTop: true,
        ambientLighting: true,
        soundEffects: true,
        speechSpeed: 1.05
      }
    };

    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.memory = JSON.parse(raw);
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('[Memory] Failed to load memory file, using defaults:', err.message);
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.memory, null, 2), 'utf8');
    } catch (err) {
      console.error('[Memory] Failed to write memory file:', err.message);
    }
  }

  addFact(factText) {
    const newFact = {
      id: Date.now(),
      text: factText,
      timestamp: new Date().toISOString().split('T')[0]
    };
    this.memory.facts.push(newFact);
    this.save();
    return newFact;
  }

  removeFact(id) {
    this.memory.facts = this.memory.facts.filter(f => f.id !== id);
    this.save();
  }

  setUserName(name) {
    this.memory.user.name = name;
    this.save();
  }

  getAll() {
    return this.memory;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MemoryStore };
}
