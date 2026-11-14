/**
 * SUNDAY v2 - 3D Minecraft Humanoid Voxel Rig (Three.js)
 * Implements canonical Sunday character:
 * - Green hoodie with "S" logo
 * - Layered messy brown hair voxels
 * - Audio headset with neon earcups
 * - Procedural blinking, lip-sync mouth, and cursor eye/head tracking
 * - Detachable props: Work desk + chair
 */

import * as THREE from '/node_modules/three/build/three.module.js';

export class VoxelRig {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'SundayCharacter';

    // Materials Palette
    this.colors = {
      skin: 0xffd1b3,
      hair: 0x5a3825,
      hairHighlight: 0x6e4530,
      hoodie: 0x2e8540,
      hoodieDark: 0x1f5e2c,
      logoGreen: 0x00ff88,
      pants: 0x1e293b,
      shoes: 0x0f172a,
      headsetBlack: 0x111827,
      headsetGlow: 0x06b6d4,
      eyeWhite: 0xffffff,
      eyePupil: 0x2563eb,
      mouth: 0x991b1b
    };

    this.materials = {};
    this.initMaterials();
    this.buildRig();
    this.buildProps();

    this.scene.add(this.root);

    // Micro-motion states
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.targetHeadRotation = { x: 0, y: 0 };
    this.currentHeadRotation = { x: 0, y: 0 };
    this.mouthOpenAmount = 0; // 0 (closed) to 1 (wide open)
    this.breathCycle = 0;
  }

  initMaterials() {
    for (const [key, hex] of Object.entries(this.colors)) {
      this.materials[key] = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.65,
        metalness: key.includes('headset') || key.includes('logo') ? 0.4 : 0.1,
        emissive: key === 'logoGreen' ? 0x00aa55 : key === 'headsetGlow' ? 0x0088aa : 0x000000,
        emissiveIntensity: key.includes('logo') || key.includes('Glow') ? 0.35 : 0.0
      });
    }
  }

  buildRig() {
    // 1. Torso (12 wide, 16 high, 8 deep - scaled to 0.1 units)
    const torsoGeo = new THREE.BoxGeometry(1.2, 1.6, 0.8);
    this.torso = new THREE.Mesh(torsoGeo, this.materials.hoodie);
    this.torso.position.y = 2.4;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.root.add(this.torso);

    // Hoodie "S" Emblem on Chest
    const logoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.05);
    this.logo = new THREE.Mesh(logoGeo, this.materials.logoGreen);
    this.logo.position.set(0, 0.1, 0.42);
    this.torso.add(this.logo);

    // 2. Head Pivot & Mesh
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.8, 0); // At top of torso
    this.torso.add(this.headPivot);

    const headGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    this.head = new THREE.Mesh(headGeo, this.materials.skin);
    this.head.position.set(0, 0.55, 0);
    this.head.castShadow = true;
    this.headPivot.add(this.head);

    // Eyes
    const eyeGeo = new THREE.BoxGeometry(0.18, 0.12, 0.05);
    this.leftEye = new THREE.Mesh(eyeGeo, this.materials.eyePupil);
    this.leftEye.position.set(-0.25, 0.05, 0.56);
    this.head.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, this.materials.eyePupil);
    this.rightEye.position.set(0.25, 0.05, 0.56);
    this.head.add(this.rightEye);

    // Mouth (Lip-sync dynamic scale)
    const mouthGeo = new THREE.BoxGeometry(0.24, 0.08, 0.04);
    this.mouth = new THREE.Mesh(mouthGeo, this.materials.mouth);
    this.mouth.position.set(0, -0.22, 0.56);
    this.head.add(this.mouth);

    // Messy Brown Hair Voxels (overlapping layered cubes)
    this.buildMessyHair();

    // Headset with glowing earcups
    this.buildHeadset();

    // 3. Arms (Pivoting at shoulders)
    const armGeo = new THREE.BoxGeometry(0.5, 1.5, 0.5);

    // Left Arm Pivot
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.95, 0.65, 0);
    this.torso.add(this.leftArmPivot);

    this.leftArm = new THREE.Mesh(armGeo, this.materials.hoodie);
    this.leftArm.position.set(0, -0.65, 0);
    this.leftArm.castShadow = true;
    this.leftArmPivot.add(this.leftArm);

    // Left Hand
    const handGeo = new THREE.BoxGeometry(0.48, 0.3, 0.48);
    const leftHand = new THREE.Mesh(handGeo, this.materials.skin);
    leftHand.position.set(0, -0.65, 0);
    this.leftArm.add(leftHand);

    // Right Arm Pivot
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.95, 0.65, 0);
    this.torso.add(this.rightArmPivot);

    this.rightArm = new THREE.Mesh(armGeo, this.materials.hoodie);
    this.rightArm.position.set(0, -0.65, 0);
    this.rightArm.castShadow = true;
    this.rightArmPivot.add(this.rightArm);

    // Right Hand
    const rightHand = new THREE.Mesh(handGeo, this.materials.skin);
    rightHand.position.set(0, -0.65, 0);
    this.rightArm.add(rightHand);

    // 4. Legs (Pivoting at hips)
    const legGeo = new THREE.BoxGeometry(0.52, 1.6, 0.55);

    // Left Leg Pivot
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.32, -0.8, 0);
    this.torso.add(this.leftLegPivot);

    this.leftLeg = new THREE.Mesh(legGeo, this.materials.pants);
    this.leftLeg.position.set(0, -0.8, 0);
    this.leftLeg.castShadow = true;
    this.leftLegPivot.add(this.leftLeg);

    // Left Shoe
    const shoeGeo = new THREE.BoxGeometry(0.54, 0.3, 0.65);
    const leftShoe = new THREE.Mesh(shoeGeo, this.materials.shoes);
    leftShoe.position.set(0, -0.7, 0.05);
    this.leftLeg.add(leftShoe);

    // Right Leg Pivot
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.32, -0.8, 0);
    this.torso.add(this.rightLegPivot);

    this.rightLeg = new THREE.Mesh(legGeo, this.materials.pants);
    this.rightLeg.position.set(0, -0.8, 0);
    this.rightLeg.castShadow = true;
    this.rightLegPivot.add(this.rightLeg);

    // Right Shoe
    const rightShoe = new THREE.Mesh(shoeGeo, this.materials.shoes);
    rightShoe.position.set(0, -0.7, 0.05);
    this.rightLeg.add(rightShoe);
  }

  buildMessyHair() {
    this.hairGroup = new THREE.Group();
    this.hairGroup.name = 'MessyHair';

    // Hair Top Cap
    const topCap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.2), this.materials.hair);
    topCap.position.set(0, 0.52, 0);
    this.hairGroup.add(topCap);

    // Tufts / messy strands
    const tuftConfigs = [
      { size: [0.35, 0.35, 0.35], pos: [-0.35, 0.65, 0.15] },
      { size: [0.4, 0.4, 0.3], pos: [0.1, 0.68, -0.1] },
      { size: [0.3, 0.35, 0.3], pos: [0.35, 0.62, 0.2] },
      { size: [0.25, 0.45, 0.25], pos: [-0.25, 0.3, 0.58] }, // Front messy fringe
      { size: [0.3, 0.38, 0.25], pos: [0.2, 0.28, 0.58] },  // Front messy fringe
      { size: [0.25, 0.6, 1.15], pos: [-0.55, 0.2, 0] },    // Left side hair
      { size: [0.25, 0.6, 1.15], pos: [0.55, 0.2, 0] },     // Right side hair
      { size: [1.15, 0.7, 0.25], pos: [0, 0.15, -0.55] }    // Back hair
    ];

    tuftConfigs.forEach((cfg, idx) => {
      const mat = idx % 2 === 0 ? this.materials.hair : this.materials.hairHighlight;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...cfg.size), mat);
      mesh.position.set(...cfg.pos);
      this.hairGroup.add(mesh);
    });

    this.head.add(this.hairGroup);
  }

  buildHeadset() {
    this.headsetGroup = new THREE.Group();
    this.headsetGroup.name = 'AudioHeadset';

    // Headband across top of head
    const bandGeo = new THREE.BoxGeometry(1.32, 0.12, 0.25);
    const band = new THREE.Mesh(bandGeo, this.materials.headsetBlack);
    band.position.set(0, 0.62, 0);
    this.headsetGroup.add(band);

    // Left Earcup
    const earcupGeo = new THREE.BoxGeometry(0.18, 0.45, 0.4);
    const leftCup = new THREE.Mesh(earcupGeo, this.materials.headsetBlack);
    leftCup.position.set(-0.62, 0.05, 0);
    this.headsetGroup.add(leftCup);

    const leftGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.22), this.materials.headsetGlow);
    leftGlow.position.set(-0.72, 0.05, 0);
    this.headsetGroup.add(leftGlow);

    // Right Earcup
    const rightCup = new THREE.Mesh(earcupGeo, this.materials.headsetBlack);
    rightCup.position.set(0.62, 0.05, 0);
    this.headsetGroup.add(rightCup);

    const rightGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.22), this.materials.headsetGlow);
    rightGlow.position.set(0.72, 0.05, 0);
    this.headsetGroup.add(rightGlow);

    // Mic arm from left earcup
    const micArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), this.materials.headsetBlack);
    micArm.position.set(-0.55, -0.12, 0.35);
    micArm.rotation.y = -0.3;
    this.headsetGroup.add(micArm);

    const micTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.materials.headsetGlow);
    micTip.position.set(-0.45, -0.12, 0.58);
    this.headsetGroup.add(micTip);

    this.head.add(this.headsetGroup);
  }

  buildProps() {
    // 1. Mini Workstation Desk with Laptop (toggled on "Working")
    this.deskProp = new THREE.Group();
    this.deskProp.name = 'WorkstationDesk';
    this.deskProp.position.set(0, 0, 1.2);
    this.deskProp.visible = false;

    // Wooden desk top
    const deskTopMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.2), deskTopMat);
    top.position.set(0, 1.4, 0);
    top.castShadow = true;
    this.deskProp.add(top);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const legGeo = new THREE.BoxGeometry(0.12, 1.4, 0.12);
    [
      [-1.0, 0.7, -0.45],
      [1.0, 0.7, -0.45],
      [-1.0, 0.7, 0.45],
      [1.0, 0.7, 0.45]
    ].forEach(pos => {
      const l = new THREE.Mesh(legGeo, legMat);
      l.position.set(...pos);
      this.deskProp.add(l);
    });

    // Laptop
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), this.materials.headsetBlack);
    laptopBase.position.set(0, 1.48, 0);
    this.deskProp.add(laptopBase);

    const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.04), this.materials.headsetGlow);
    laptopScreen.position.set(0, 1.76, -0.26);
    laptopScreen.rotation.x = -0.2;
    this.deskProp.add(laptopScreen);

    this.root.add(this.deskProp);

    // 2. Chair Prop (toggled on "Sitting")
    this.chairProp = new THREE.Group();
    this.chairProp.name = 'Chair';
    this.chairProp.position.set(0, 0, 0);
    this.chairProp.visible = false;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), deskTopMat);
    seat.position.set(0, 1.0, 0);
    this.chairProp.add(seat);

    const backrest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.15), deskTopMat);
    backrest.position.set(0, 1.6, -0.5);
    this.chairProp.add(backrest);

    this.root.add(this.chairProp);
  }

  /**
   * Set look-at coordinate (normalized -1 to 1) for eyes/head tracking
   */
  setLookTarget(normX, normY) {
    this.targetHeadRotation.y = -normX * 0.45; // Yaw
    this.targetHeadRotation.x = -normY * 0.35; // Pitch
  }

  /**
   * Update audio amplitude lip-sync (0.0 to 1.0)
   */
  setMouthAmplitude(amp) {
    this.mouthOpenAmount = THREE.MathUtils.clamp(amp, 0, 1);
  }

  /**
   * Apply a custom skin texture from a canvas element
   */
  applySkinCanvas(canvas) {
    if (!canvas) return;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    // Apply texture to torso and head
    this.torso.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
    this.head.material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
  }

  /**
   * Reset rig transforms before blending
   */
  resetTransforms() {
    this.torso.position.set(0, 2.4, 0);
    this.torso.rotation.set(0, 0, 0);
    this.headPivot.rotation.set(0, 0, 0);
    this.leftArmPivot.position.set(-0.95, 0.65, 0);
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightArmPivot.position.set(0.95, 0.65, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftLegPivot.position.set(-0.32, -0.8, 0);
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.position.set(0.32, -0.8, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);

    this.deskProp.visible = false;
    this.chairProp.visible = false;
  }

  /**
   * Procedural micro-motion tick (breathing, blinking, tracking, mouth visemes)
   */
  update(delta) {
    // 1. Procedural breathing
    this.breathCycle += delta * 2.2;
    const breathBob = Math.sin(this.breathCycle) * 0.025;
    this.torso.position.y += breathBob;

    // 2. Smooth head tracking interpolation
    this.currentHeadRotation.x += (this.targetHeadRotation.x - this.currentHeadRotation.x) * 0.12;
    this.currentHeadRotation.y += (this.targetHeadRotation.y - this.currentHeadRotation.y) * 0.12;
    this.headPivot.rotation.x = this.currentHeadRotation.x;
    this.headPivot.rotation.y = this.currentHeadRotation.y;

    // 3. Procedural blinking
    this.blinkTimer += delta;
    if (this.blinkTimer > 3.8) {
      this.isBlinking = true;
      if (this.blinkTimer > 4.0) {
        this.isBlinking = false;
        this.blinkTimer = Math.random() * 1.5; // Randomize next blink
      }
    }
    const eyeScaleY = this.isBlinking ? 0.1 : 1.0;
    this.leftEye.scale.y = eyeScaleY;
    this.rightEye.scale.y = eyeScaleY;

    // 4. Lip-sync mouth morphing
    const mouthScaleY = 1.0 + this.mouthOpenAmount * 3.5;
    this.mouth.scale.y = mouthScaleY;
  }
}
