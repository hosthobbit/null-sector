// Floating pickups: health, shield, ammo, weapons.
import * as THREE from 'three';

const KINDS = {
  health:  { color: 0xff3b5c, label: '+25 INTEGRITY' },
  shield:  { color: 0x38f2ff, label: '+35 SHIELD' },
  ammo:    { color: 0xffb347, label: 'AMMUNITION' },
  scatter: { color: 0xffb347, label: 'SCATTER CANNON ACQUIRED', weapon: 1 },
  ripper:  { color: 0xffd060, label: 'RIPPER ACQUIRED', weapon: 2 },
  arc:     { color: 0xff2e88, label: 'ARC LAUNCHER ACQUIRED', weapon: 3 },
  rail:    { color: 0x6ab8ff, label: 'RAIL LANCE ACQUIRED', weapon: 4 },
  bfg:     { color: 0x5dff5d, label: 'OBLIVION BFG ACQUIRED', weapon: 5 },
  cell:    { color: 0x5dff5d, label: '+1 OBLIVION CELL' },
};

function model(kind) {
  const c = KINDS[kind].color;
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 1.1 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x1b2029, metalness: 0.8, roughness: 0.3 });
  const g = new THREE.Group();
  if (kind === 'health') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), glow));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), glow));
    const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color: c, wireframe: true, emissive: c, emissiveIntensity: 1 })); g.add(cage);
  } else if (kind === 'shield') {
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 6), shell); hex.rotation.x = Math.PI / 2; g.add(hex);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 6), glow); face.rotation.x = Math.PI / 2; g.add(face);
  } else if (kind === 'cell') {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12), shell); g.add(cell);
    const win = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 12), glow); g.add(win);
  } else if (kind === 'ammo') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.32), shell));
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.34), glow); g.add(band);
  } else {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(kind === 'bfg' ? 0.4 : 0.28, 0), glow); g.add(core);
    if (kind === 'bfg') g.scale.setScalar(1.3);
    for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + i * 0.12, 0.02, 6, 32), glow); r.rotation.x = i ? Math.PI / 2 : 0; g.add(r); }
  }
  return g;
}

export class Pickups {
  constructor(scene) { this.scene = scene; this.list = []; }
  add(kind, pos) {
    const g = model(kind); g.position.set(pos.x, 0.9, pos.z);
    this.scene.add(g);
    this.list.push({ kind, g, t: Math.random() * 6, ...KINDS[kind] });
  }
  update(dt, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt; p.g.rotation.y += dt * 1.6; p.g.position.y = 0.9 + Math.sin(p.t * 2.5) * 0.12;
      const d = Math.hypot(p.g.position.x - game.player.pos.x, p.g.position.z - game.player.pos.z);
      if (d < 1.3 && game.tryPickup(p)) { this.scene.remove(p.g); this.list.splice(i, 1); }
    }
  }
  clear() { for (const p of this.list) this.scene.remove(p.g); this.list = []; }
}
