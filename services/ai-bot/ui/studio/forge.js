/**
 * SUNDAY v2 - Character Forge & Skin Generator (WOW 2)
 * Features:
 * - 64x64 Canvas texture editor with real-time 3D unwrap
 * - Procedural palette generators (hair, eyes, outfit, headset)
 * - 4 Built-in Skin Presets
 * - Portable .sunday bundle export and import
 */

export class CharacterForge {
  constructor(rig, onSkinUpdated) {
    this.rig = rig;
    this.onSkinUpdated = onSkinUpdated;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 64;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d');

    this.currentColor = '#2e8540';
    this.currentTool = 'pencil';
    this.pixelSize = 8; // Zoom level in UI canvas

    // Preset skins
    this.presets = {
      classic: {
        name: 'Sunday Classic',
        hair: '#5a3825',
        eyes: '#2563eb',
        hoodie: '#2e8540',
        logo: '#00ff88',
        headset: '#06b6d4'
      },
      hacker: {
        name: 'Cyber Hacker',
        hair: '#111827',
        eyes: '#06b6d4',
        hoodie: '#090d16',
        logo: '#a855f7',
        headset: '#a855f7'
      },
      chill: {
        name: 'Chill Mentor',
        hair: '#78350f',
        eyes: '#059669',
        hoodie: '#d97706',
        logo: '#fef08a',
        headset: '#f59e0b'
      },
      champion: {
        name: 'Hackathon Gold',
        hair: '#312e81',
        eyes: '#f59e0b',
        hoodie: '#eab308',
        logo: '#ffffff',
        headset: '#eab308'
      }
    };

    this.generateProceduralSkin(this.presets.classic);
  }

  generateProceduralSkin(palette) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 64, 64);

    // Head base (Skin tone: x: 0-32, y: 0-16)
    ctx.fillStyle = '#ffd1b3';
    ctx.fillRect(0, 0, 32, 16);

    // Hair cap (x: 0-32, y: 0-8)
    ctx.fillStyle = palette.hair;
    ctx.fillRect(0, 0, 32, 8);

    // Eyes (x: 8, 20, y: 10)
    ctx.fillStyle = palette.eyes;
    ctx.fillRect(8, 10, 4, 3);
    ctx.fillRect(20, 10, 4, 3);

    // Torso / Hoodie (x: 16-40, y: 16-32)
    ctx.fillStyle = palette.hoodie;
    ctx.fillRect(16, 16, 24, 16);

    // "S" Logo on chest
    ctx.fillStyle = palette.logo;
    ctx.fillRect(26, 20, 5, 2);
    ctx.fillRect(26, 22, 2, 2);
    ctx.fillRect(26, 24, 5, 2);
    ctx.fillRect(29, 26, 2, 2);
    ctx.fillRect(26, 28, 5, 2);

    // Arms (x: 40-56, y: 16-32)
    ctx.fillStyle = palette.hoodie;
    ctx.fillRect(40, 16, 16, 16);

    // Legs / Pants (x: 0-16, y: 16-32)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 16, 16, 16);

    // Apply to 3D rig
    if (this.rig && this.rig.applySkinCanvas) {
      this.rig.applySkinCanvas(this.canvas);
    }
    if (this.onSkinUpdated) {
      this.onSkinUpdated(this.canvas);
    }
  }

  setPixel(x, y, color) {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 1, 1);
    this.rig.applySkinCanvas(this.canvas);
    if (this.onSkinUpdated) this.onSkinUpdated(this.canvas);
  }

  exportSundayPackage(characterName, personalityId) {
    const dataUrl = this.canvas.toDataURL('image/png');
    const bundle = {
      format: 'sunday_character_v2',
      name: characterName || 'Custom Companion',
      version: '2.0',
      created: new Date().toISOString(),
      personality: personalityId || 'classic',
      texture: dataUrl,
      rigCompatibility: 'voxel_humanoid_v2'
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${characterName.toLowerCase().replace(/\s+/g, '_')}.sunday`;
    a.click();
    URL.revokeObjectURL(url);
    return bundle;
  }

  importSundayPackage(jsonText) {
    try {
      const bundle = JSON.parse(jsonText);
      if (bundle.texture) {
        const img = new Image();
        img.onload = () => {
          this.ctx.clearRect(0, 0, 64, 64);
          this.ctx.drawImage(img, 0, 0);
          this.rig.applySkinCanvas(this.canvas);
          if (this.onSkinUpdated) this.onSkinUpdated(this.canvas);
        };
        img.src = bundle.texture;
      }
      return bundle;
    } catch (err) {
      console.error('[CharacterForge] Failed to import .sunday package:', err);
      return null;
    }
  }
}
