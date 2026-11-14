/**
 * SUNDAY v2 - Animation Library & Blending Controller
 * Implements 20+ procedural keyframe animations:
 * Idle, Thinking, Walking, Running, Jumping, Sitting, Working (typing), Talking, Listening,
 * Sleeping, Celebrating, Confused, Surprised, Happy, Sad, Focused, Dragged, Wave, Point, Thumbs-up.
 * Features 150-250ms cross-fading and timeline scrubbing.
 */

export class AnimationController {
  constructor(rig) {
    this.rig = rig;
    this.currentClip = 'idle';
    this.targetClip = 'idle';
    this.blendWeight = 1.0;
    this.blendSpeed = 5.0; // ~200ms cross-fade
    this.playTime = 0;
    this.playbackSpeed = 1.0;
    this.isPaused = false;
    this.isLooping = true;

    // Snapshot of previous pose for smooth slerp cross-fades
    this.previousPose = this.capturePose();
    this.currentPose = this.capturePose();
  }

  capturePose() {
    return {
      torsoPos: { y: this.rig.torso.position.y },
      torsoRot: { x: this.rig.torso.rotation.x, z: this.rig.torso.rotation.z },
      headRot: { x: this.rig.headPivot.rotation.x, y: this.rig.headPivot.rotation.y, z: this.rig.headPivot.rotation.z },
      leftArmRot: { x: this.rig.leftArmPivot.rotation.x, z: this.rig.leftArmPivot.rotation.z },
      rightArmRot: { x: this.rig.rightArmPivot.rotation.x, z: this.rig.rightArmPivot.rotation.z },
      leftLegRot: { x: this.rig.leftLegPivot.rotation.x, z: this.rig.leftLegPivot.rotation.z },
      rightLegRot: { x: this.rig.rightLegPivot.rotation.x, z: this.rig.rightLegPivot.rotation.z }
    };
  }

  play(clipName, loop = true) {
    if (this.currentClip === clipName && this.blendWeight >= 1.0) return;
    this.previousPose = this.capturePose();
    this.targetClip = clipName;
    this.blendWeight = 0.0;
    this.isLooping = loop;
    this.isPaused = false;
  }

  scrub(time) {
    this.playTime = time;
    this.evaluateClip(this.targetClip, this.playTime);
  }

  update(delta) {
    if (this.isPaused) return;

    const scaledDelta = delta * this.playbackSpeed;
    this.playTime += scaledDelta;

    // Update cross-fade transition
    if (this.blendWeight < 1.0) {
      this.blendWeight += delta * this.blendSpeed;
      if (this.blendWeight >= 1.0) {
        this.blendWeight = 1.0;
        this.currentClip = this.targetClip;
      }
    }

    // Evaluate target clip at current playTime
    this.evaluateClip(this.targetClip, this.playTime);

    // If blending, interpolate from previousPose
    if (this.blendWeight < 1.0) {
      this.applyBlend(this.previousPose, this.blendWeight);
    }
  }

  evaluateClip(clip, t) {
    const r = this.rig;
    r.resetTransforms();

    switch (clip) {
      case 'idle':
        // Gentle rhythmic idle with micro weight shift
        r.leftArmPivot.rotation.z = Math.sin(t * 1.5) * 0.05 + 0.1;
        r.rightArmPivot.rotation.z = -Math.sin(t * 1.5) * 0.05 - 0.1;
        r.torso.rotation.y = Math.sin(t * 0.8) * 0.04;
        break;

      case 'walking':
        // Natural bipedal walk cycle
        r.torso.position.y = 2.4 + Math.abs(Math.sin(t * 5.0)) * 0.12;
        r.leftLegPivot.rotation.x = Math.sin(t * 5.0) * 0.65;
        r.rightLegPivot.rotation.x = -Math.sin(t * 5.0) * 0.65;
        r.leftArmPivot.rotation.x = -Math.sin(t * 5.0) * 0.55;
        r.rightArmPivot.rotation.x = Math.sin(t * 5.0) * 0.55;
        break;

      case 'running':
        // Energetic forward-canted sprint
        r.torso.position.y = 2.3 + Math.abs(Math.sin(t * 8.0)) * 0.2;
        r.torso.rotation.x = 0.25; // Lean forward
        r.leftLegPivot.rotation.x = Math.sin(t * 8.0) * 0.95;
        r.rightLegPivot.rotation.x = -Math.sin(t * 8.0) * 0.95;
        r.leftArmPivot.rotation.x = -Math.sin(t * 8.0) * 0.9;
        r.rightArmPivot.rotation.x = Math.sin(t * 8.0) * 0.9;
        break;

      case 'jumping':
        // Jump arc
        const jumpPhase = Math.sin(t * 3.5);
        r.torso.position.y = 2.4 + Math.max(0, jumpPhase) * 1.2;
        r.leftArmPivot.rotation.x = -2.2;
        r.rightArmPivot.rotation.x = -2.2;
        r.leftLegPivot.rotation.x = 0.4;
        r.rightLegPivot.rotation.x = 0.4;
        break;

      case 'sitting':
        // Sitting with chair prop
        r.chairProp.visible = true;
        r.torso.position.y = 1.6;
        r.leftLegPivot.rotation.x = -1.57; // 90 deg forward
        r.rightLegPivot.rotation.x = -1.57;
        r.leftArmPivot.rotation.x = -0.3;
        r.rightArmPivot.rotation.x = -0.3;
        break;

      case 'thinking':
      case 'idle-thinking':
        // Hand under chin, inquisitive head tilt
        r.headPivot.rotation.z = 0.18;
        r.headPivot.rotation.x = 0.12;
        r.rightArmPivot.rotation.x = -1.8;
        r.rightArmPivot.rotation.z = -0.55;
        r.leftArmPivot.rotation.x = -0.2;
        r.leftArmPivot.rotation.z = 0.2;
        break;

      case 'working':
        // Typing at mini desk
        r.deskProp.visible = true;
        r.torso.position.y = 2.1;
        r.torso.rotation.x = 0.15; // Leaning into keyboard
        r.leftArmPivot.rotation.x = -1.2 + Math.sin(t * 14.0) * 0.15;
        r.rightArmPivot.rotation.x = -1.2 + Math.cos(t * 14.0) * 0.15;
        r.leftArmPivot.rotation.z = 0.25;
        r.rightArmPivot.rotation.z = -0.25;
        break;

      case 'listening':
        // Attentive lean, ear tilted forward
        r.headPivot.rotation.y = 0.25;
        r.headPivot.rotation.z = -0.15;
        r.torso.position.y = 2.4 + Math.sin(t * 2.0) * 0.02;
        r.leftArmPivot.rotation.z = 0.3;
        r.rightArmPivot.rotation.z = -0.3;
        break;

      case 'talking':
        // Expressive conversational gestures
        r.leftArmPivot.rotation.x = -0.6 + Math.sin(t * 3.5) * 0.35;
        r.rightArmPivot.rotation.x = -0.8 + Math.cos(t * 4.0) * 0.4;
        r.headPivot.rotation.x = Math.sin(t * 3.0) * 0.08;
        r.headPivot.rotation.y = Math.cos(t * 2.2) * 0.08;
        break;

      case 'sleeping':
        // Head drooped, rhythmic deep sleep breathing
        r.torso.position.y = 2.2;
        r.headPivot.rotation.x = 0.55; // Drooped forward
        r.leftArmPivot.rotation.z = 0.15;
        r.rightArmPivot.rotation.z = -0.15;
        break;

      case 'celebrating':
        // Joyous jump and double arms pumping the air
        const celPhase = Math.sin(t * 6.0);
        r.torso.position.y = 2.4 + Math.abs(celPhase) * 0.6;
        r.leftArmPivot.rotation.x = -2.8 + Math.sin(t * 12.0) * 0.3;
        r.rightArmPivot.rotation.x = -2.8 + Math.cos(t * 12.0) * 0.3;
        r.leftArmPivot.rotation.z = 0.4;
        r.rightArmPivot.rotation.z = -0.4;
        r.headPivot.rotation.x = -0.3; // Looking up proudly
        break;

      case 'confused':
        // Head tilted, hands spread outwards
        r.headPivot.rotation.z = -0.35;
        r.headPivot.rotation.y = 0.2;
        r.leftArmPivot.rotation.z = 0.65;
        r.rightArmPivot.rotation.z = -0.65;
        r.leftArmPivot.rotation.x = -0.4;
        r.rightArmPivot.rotation.x = -0.4;
        break;

      case 'surprised':
        // Jump back slightly, arms back
        r.torso.position.z = -0.3;
        r.headPivot.rotation.x = -0.25;
        r.leftArmPivot.rotation.x = 0.5;
        r.rightArmPivot.rotation.x = 0.5;
        r.leftArmPivot.rotation.z = 0.4;
        r.rightArmPivot.rotation.z = -0.4;
        break;

      case 'happy':
        // Gentle sway and open posture
        r.torso.rotation.y = Math.sin(t * 2.5) * 0.15;
        r.leftArmPivot.rotation.z = 0.35 + Math.sin(t * 2.5) * 0.1;
        r.rightArmPivot.rotation.z = -0.35 - Math.sin(t * 2.5) * 0.1;
        break;

      case 'sad':
        // Slumped shoulders, head down
        r.torso.rotation.x = 0.2;
        r.headPivot.rotation.x = 0.45;
        r.leftArmPivot.rotation.z = 0.05;
        r.rightArmPivot.rotation.z = -0.05;
        break;

      case 'focused':
        // Straight posture, head locked forward
        r.torso.rotation.x = 0.05;
        r.headPivot.rotation.x = 0.0;
        r.leftArmPivot.rotation.x = -0.3;
        r.rightArmPivot.rotation.x = -0.3;
        break;

      case 'dragged':
        // Character dangling arms and legs as if window is being dragged
        r.leftArmPivot.rotation.x = -2.6;
        r.rightArmPivot.rotation.x = -2.6;
        r.leftLegPivot.rotation.z = 0.3;
        r.rightLegPivot.rotation.z = -0.3;
        break;

      case 'wave':
        // Right hand raised high, waving side to side
        r.rightArmPivot.rotation.x = -2.7;
        r.rightArmPivot.rotation.z = -0.3 + Math.sin(t * 10.0) * 0.45;
        r.headPivot.rotation.y = -0.15;
        break;

      case 'point':
        // Pointing directly forward
        r.rightArmPivot.rotation.x = -1.57; // 90 deg forward
        r.rightArmPivot.rotation.y = -0.1;
        r.headPivot.rotation.y = -0.2;
        break;

      case 'thumbs-up':
      case 'thumbs_up':
        // Arm forward, thumbs up gesture
        r.rightArmPivot.rotation.x = -1.4;
        r.rightArmPivot.rotation.z = -0.2;
        r.headPivot.rotation.z = -0.1;
        break;

      default:
        // Default fallback to idle
        r.leftArmPivot.rotation.z = 0.1;
        r.rightArmPivot.rotation.z = -0.1;
    }
  }

  applyBlend(prev, alpha) {
    const r = this.rig;
    const lerp = (a, b, t) => a + (b - a) * t;

    r.torso.position.y = lerp(prev.torsoPos.y, r.torso.position.y, alpha);
    r.torso.rotation.x = lerp(prev.torsoRot.x, r.torso.rotation.x, alpha);
    r.torso.rotation.z = lerp(prev.torsoRot.z, r.torso.rotation.z, alpha);

    r.leftArmPivot.rotation.x = lerp(prev.leftArmRot.x, r.leftArmPivot.rotation.x, alpha);
    r.leftArmPivot.rotation.z = lerp(prev.leftArmRot.z, r.leftArmPivot.rotation.z, alpha);

    r.rightArmPivot.rotation.x = lerp(prev.rightArmRot.x, r.rightArmPivot.rotation.x, alpha);
    r.rightArmPivot.rotation.z = lerp(prev.rightArmRot.z, r.rightArmPivot.rotation.z, alpha);

    r.leftLegPivot.rotation.x = lerp(prev.leftLegRot.x, r.leftLegPivot.rotation.x, alpha);
    r.rightLegPivot.rotation.x = lerp(prev.rightLegRot.x, r.rightLegPivot.rotation.x, alpha);
  }
}
