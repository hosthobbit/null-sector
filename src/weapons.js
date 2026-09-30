// Weapon definitions and first-person viewmodels (built from primitives, lit by the scene).
import * as THREE from 'three';

export const WEAPONS = [
  { id: 'carbine', name: 'PULSE CARBINE', mag: 30, reserve: 150, maxReserve: 300, rate: 0.095, dmg: 16, pellets: 1, spread: 0.012, sprintSpread: 0.05, auto: true, reload: 1.3, color: 0x38f2ff, kick: 0.035, shake: 0.12 },
  { id: 'scatter', name: 'SCATTER CANNON', mag: 6, reserve: 24, maxReserve: 48, rate: 0.78, dmg: 13, pellets: 10, spread: 0.075, sprintSpread: 0.1, auto: false, reload: 1.9, color: 0xffb347, kick: 0.14, shake: 0.55 },
  { id: 'ripper', name: 'RIPPER', mag: 100, reserve: 200, maxReserve: 400, rate: 0.045, dmg: 10, pellets: 1, spread: 0.028, sprintSpread: 0.07, auto: true, reload: 2.4, color: 0xffd060, kick: 0.012, shake: 0.09, spin: 0.35 },
  { id: 'arc', name: 'ARC LAUNCHER', mag: 4, reserve: 8, maxReserve: 20, rate: 0.9, dmg: 110, splash: 5.2, speed: 34, pellets: 1, spread: 0.004, sprintSpread: 0.02, auto: false, reload: 2.2, color: 0xff2e88, kick: 0.18, shake: 0.7, projectile: true },
  { id: 'rail', name: 'RAIL LANCE', mag: 3, reserve: 12, maxReserve: 24, rate: 1.1, dmg: 260, pellets: 1, spread: 0, sprintSpread: 0.01, auto: false, reload: 2.0, color: 0x6ab8ff, kick: 0.22, shake: 0.6, pierce: true },
  { id: 'bfg', name: 'OBLIVION BFG', mag: 1, reserve: 2, maxReserve: 5, rate: 1.8, dmg: 999999, splash: 40, speed: 17, pellets: 1, spread: 0, sprintSpread: 0, auto: false, reload: 2.6, color: 0x5dff5d, kick: 0.45, shake: 1.6, projectile: true, bfg: true, charge: 0.9 },
];

const metal = (c, r = 0.35) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: r + 0.1 });
const glowMat = c => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 1.4 });

function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function cyl(r, len, mat, x, y, z, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }

function buildCarbine() {
  const g = new THREE.Group(), dark = metal(0x20242c, 0.4), mid = metal(0x3b414d, 0.3), acc = glowMat(0x38f2ff);
  g.add(box(0.09, 0.11, 0.55, dark, 0, 0, -0.1));             // receiver
  g.add(box(0.07, 0.05, 0.4, mid, 0, 0.075, -0.15));           // top rail
  g.add(cyl(0.022, 0.42, mid, 0, 0.01, -0.55));                // barrel
  g.add(cyl(0.04, 0.16, dark, 0, 0.01, -0.45));                // shroud
  g.add(box(0.06, 0.16, 0.08, dark, 0, -0.12, 0.02));          // grip
  g.add(box(0.05, 0.14, 0.1, mid, 0, -0.11, -0.2));            // mag
  g.add(box(0.1, 0.012, 0.3, acc, 0, 0.056, -0.12));           // glow strip
  g.add(box(0.012, 0.03, 0.3, acc, 0.047, 0.0, -0.1));
  g.add(box(0.045, 0.045, 0.07, dark, 0, 0.115, -0.02));        // sight housing
  g.add(box(0.012, 0.012, 0.075, glowMat(0xff2e88), 0, 0.115, -0.02)); // sight dot
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 20), acc); coil.position.set(0, 0.01, -0.62); g.add(coil);
  return { g, muzzle: new THREE.Vector3(0, 0.01, -0.78), glow: [acc] };
}

function buildScatter() {
  const g = new THREE.Group(), dark = metal(0x1c1f25, 0.45), brass = metal(0x5a4520, 0.45), acc = glowMat(0xffb347);
  g.add(box(0.13, 0.13, 0.5, dark, 0, 0, -0.1));
  g.add(cyl(0.035, 0.5, dark, -0.035, 0.02, -0.55)); g.add(cyl(0.035, 0.5, dark, 0.035, 0.02, -0.55));
  g.add(cyl(0.045, 0.05, brass, -0.035, 0.02, -0.8)); g.add(cyl(0.045, 0.05, brass, 0.035, 0.02, -0.8));
  g.add(box(0.1, 0.07, 0.24, brass, 0, -0.06, -0.42));         // pump
  g.add(box(0.07, 0.17, 0.09, dark, 0, -0.13, 0.03));
  g.add(box(0.03, 0.012, 0.32, acc, 0, 0.068, -0.1));
  for (let i = 0; i < 4; i++) g.add(box(0.02, 0.02, 0.02, acc, 0.07, 0.03, -0.02 - i * 0.06));
  return { g, muzzle: new THREE.Vector3(0, 0.02, -0.85), glow: [acc], pump: g.children[5] };
}

function buildArc() {
  const g = new THREE.Group(), dark = metal(0x1a1c24, 0.3), mid = metal(0x40384d, 0.25), acc = glowMat(0xff2e88);
  g.add(box(0.15, 0.15, 0.55, dark, 0, 0, -0.12));
  g.add(cyl(0.07, 0.36, mid, 0, 0.02, -0.52, 6));
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 24), acc); r.position.set(0, 0.02, -0.4 - i * 0.12); g.add(r); }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), acc); core.position.set(0, 0.11, -0.05); g.add(core);
  g.add(box(0.08, 0.18, 0.09, dark, 0, -0.14, 0.02));
  g.add(box(0.02, 0.1, 0.4, acc, 0.078, 0, -0.12));
  return { g, muzzle: new THREE.Vector3(0, 0.02, -0.75), glow: [acc], core };
}

function buildRipper() {
  const g = new THREE.Group(), dark = metal(0x23262d, 0.35), mid = metal(0x4a4f5a, 0.25), acc = glowMat(0xffd060);
  g.add(box(0.16, 0.16, 0.42, dark, 0, -0.01, -0.05));
  g.add(box(0.07, 0.18, 0.1, dark, 0, -0.16, 0.08));
  g.add(box(0.14, 0.05, 0.34, mid, 0, 0.1, -0.05));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 16), mid); drum.rotation.z = Math.PI / 2; drum.position.set(-0.13, -0.05, 0.02); g.add(drum);
  const spinner = new THREE.Group(); spinner.position.set(0, 0, -0.3); g.add(spinner);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = cyl(0.016, 0.62, mid, Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.28); spinner.add(b); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 20), acc); ring.position.z = -0.52; spinner.add(ring);
  g.add(box(0.162, 0.012, 0.3, acc, 0, 0.045, -0.05));
  return { g, muzzle: new THREE.Vector3(0, 0, -0.95), glow: [acc], spinner };
}

function buildRail() {
  const g = new THREE.Group(), dark = metal(0x1e222a, 0.3), mid = metal(0x5a6070, 0.2), acc = glowMat(0x6ab8ff);
  g.add(box(0.1, 0.13, 0.5, dark, 0, 0, -0.05));
  g.add(box(0.035, 0.035, 0.9, mid, -0.03, 0.02, -0.6)); g.add(box(0.035, 0.035, 0.9, mid, 0.03, 0.02, -0.6));
  const coils = [];
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 20), acc); c.position.set(0, 0.02, -0.3 - i * 0.14); g.add(c); coils.push(c); }
  g.add(box(0.06, 0.17, 0.08, dark, 0, -0.14, 0.08));
  g.add(box(0.07, 0.07, 0.2, dark, 0, 0.1, 0.0));
  g.add(box(0.012, 0.012, 0.21, glowMat(0x6ab8ff), 0, 0.137, 0.0));
  return { g, muzzle: new THREE.Vector3(0, 0.02, -1.08), glow: [acc], coils };
}

function buildBFG() {
  const g = new THREE.Group(), dark = metal(0x1b1f1b, 0.35), mid = metal(0x3a4a3a, 0.25), acc = glowMat(0x5dff5d);
  g.add(box(0.26, 0.24, 0.62, dark, 0, 0, -0.12));
  g.add(box(0.3, 0.08, 0.5, mid, 0, 0.15, -0.12));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), acc); core.position.set(0, 0.02, -0.5); g.add(core);
  const cage = new THREE.Group(); cage.position.set(0, 0.02, -0.5); g.add(cage);
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 28), acc); r.rotation.set(i * 1.05, i * 0.7, 0); cage.add(r); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.add(box(0.035, 0.035, 0.34, mid, Math.cos(a) * 0.17, 0.02 + Math.sin(a) * 0.17, -0.62)); }
  g.add(box(0.09, 0.2, 0.1, dark, 0, -0.2, 0.08));
  g.add(box(0.27, 0.02, 0.4, acc, 0, -0.121, -0.12));
  return { g, muzzle: new THREE.Vector3(0, 0.02, -0.82), glow: [acc], core, cage };
}

export class Viewmodel {
  constructor(camera, glowTex) {
    this.root = new THREE.Group();
    camera.add(this.root);
    this.models = [buildCarbine(), buildScatter(), buildRipper(), buildArc(), buildRail(), buildBFG()];
    this.spin = 0; this.charge = 0;
    const scales = [1, 1, 0.62, 1, 0.8, 0.55];
    this.models.forEach((m, i) => m.g.scale.setScalar(scales[i]));
    for (const m of this.models) { m.g.visible = false; m.g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } }); this.root.add(m.g); }
    this.base = new THREE.Vector3(0.3, -0.29, -0.5);
    this.root.position.copy(this.base);
    this.root.scale.setScalar(1.15);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    this.flash.visible = false; this.flash.renderOrder = 999;
    this.root.add(this.flash);
    this.light = new THREE.PointLight(0xffffff, 0, 9, 2);
    this.root.add(this.light);
    // viewmodel lighting so the gun is readable in dark corridors
    this.fill = new THREE.PointLight(0x9fb8ff, 1.2, 1.6, 2); this.fill.position.set(0, 0.35, 0.1); this.root.add(this.fill);
    this.current = 0; this.recoil = 0; this.switchT = 0; this.reloadT = 0; this.reloadMax = 1; this.flashT = 0; this.t = 0;
    this.sway = new THREE.Vector2();
  }
  select(i) { this.models.forEach((m, k) => (m.g.visible = k === i)); this.current = i; this.switchT = 0.35; }
  muzzleWorld(camera) { return this.models[this.current].muzzle.clone().applyMatrix4(this.models[this.current].g.matrixWorld); }
  fire(color, kick) {
    this.recoil = Math.min(this.recoil + kick * 6, 1.3);
    this.flashT = 0.05;
    this.flash.material.color.set(color);
    this.light.color.set(color);
    const m = this.models[this.current];
    this.flash.position.copy(m.muzzle).add(new THREE.Vector3(0, 0, -0.04));
    this.light.position.copy(this.flash.position);
    this.flash.scale.setScalar(0.35 + Math.random() * 0.25);
    this.flash.material.rotation = Math.random() * 6;
  }
  startReload(t) { this.reloadT = t; this.reloadMax = t; }
  update(dt, speed, lookDelta, sprinting, grounded) {
    this.t += dt * (speed > 0.5 ? (sprinting ? 13 : 9) : 1.6);
    const bobAmp = speed > 0.5 && grounded ? (sprinting ? 0.028 : 0.014) : 0.003;
    this.sway.lerp(new THREE.Vector2(-lookDelta.x * 0.0006, lookDelta.y * 0.0006), 0.12);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.switchT = Math.max(0, this.switchT - dt);
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0; this.light.intensity = this.flashT > 0 ? 25 : 0;
    let reloadDip = 0, reloadRot = 0;
    if (this.reloadT > 0) { this.reloadT -= dt; const k = 1 - this.reloadT / this.reloadMax; reloadDip = Math.sin(k * Math.PI) * 0.18; reloadRot = Math.sin(k * Math.PI) * 0.6; }
    const sw = this.switchT / 0.35;
    this.root.position.set(
      this.base.x + Math.sin(this.t) * bobAmp + this.sway.x,
      this.base.y + Math.abs(Math.cos(this.t)) * bobAmp * 1.2 - sw * 0.35 - reloadDip + this.sway.y - (sprinting ? 0.04 : 0),
      this.base.z + this.recoil * 0.09
    );
    this.root.rotation.set(this.recoil * 0.22 + reloadRot * 0.3, 0.06 + (sprinting ? 0.35 : 0), reloadRot * 0.4 + (sprinting ? 0.15 : 0));
    const m = this.models[this.current];
    if (m.core) m.core.scale.setScalar((1 + Math.sin(performance.now() / 120) * 0.15) * (1 + this.charge * 1.3));
    if (m.cage) { m.cage.rotation.x += dt * (1 + this.charge * 14); m.cage.rotation.y += dt * (0.7 + this.charge * 10); }
    if (m.spinner) m.spinner.rotation.z += dt * this.spin * 40;
    if (m.coils) m.coils.forEach((c, i) => c.scale.setScalar(1 + Math.max(0, Math.sin(performance.now() / 90 - i)) * 0.15));
    if (m.pump) m.pump.position.z = -0.42 + Math.max(0, this.recoil - 0.6) * 0.15;
    for (const g of m.glow) g.emissiveIntensity = 1.1 + Math.sin(performance.now() / 300) * 0.3 + this.recoil * 1.5 + this.charge * 4;
  }
}
