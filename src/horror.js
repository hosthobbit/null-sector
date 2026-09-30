// Set dressing for the horror side of NULL SECTOR: corpses, hanging bodies, cages, bones,
// candles, blood and wall writing. All built from shared geometry + materials.
import * as THREE from 'three';
import { bloodSplatSprite, flameSprite, writingSprite, skinTextures } from './textures.js';

let M = null;
function mats() {
  if (M) return M;
  const skin = skinTextures([168, 150, 140]);
  M = {
    skin: new THREE.MeshStandardMaterial({ ...skin, color: 0xbba89c, roughness: 0.85, metalness: 0 }),
    cloth: [0x2a2d33, 0x3b2f25, 0x1f2a24, 0x4a4e55, 0xcfd3d8].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })),
    bone: new THREE.MeshStandardMaterial({ color: 0xd9ceb4, roughness: 0.7 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.9, roughness: 0.55 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.4 }),
    blood: new THREE.MeshStandardMaterial({ map: bloodSplatSprite(9), color: 0x3a0202, transparent: true, roughness: 0.12, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    bloodWall: new THREE.MeshStandardMaterial({ map: bloodSplatSprite(21), color: 0x520404, transparent: true, roughness: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    flame: new THREE.SpriteMaterial({ map: flameSprite(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  M.geo = {
    torso: new THREE.CapsuleGeometry(0.17, 0.42, 4, 10),
    head: new THREE.SphereGeometry(0.12, 14, 10),
    limb: new THREE.CapsuleGeometry(0.055, 0.34, 3, 8),
    skull: new THREE.SphereGeometry(0.1, 12, 8),
    jaw: new THREE.BoxGeometry(0.1, 0.04, 0.08),
    link: new THREE.TorusGeometry(0.05, 0.014, 5, 10),
    bar: new THREE.CylinderGeometry(0.02, 0.02, 2.2, 5),
    candle: new THREE.CylinderGeometry(0.035, 0.04, 0.3, 8),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  return M;
}

/** A human body. pose: 'lying' | 'hanging' | 'sitting' */
export function buildBody(rand, pose = 'lying') {
  const m = mats(), g = new THREE.Group(), cloth = m.cloth[Math.floor(rand() * m.cloth.length)];
  const part = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const p = new THREE.Mesh(geo, mat); p.position.set(x, y, z); p.rotation.set(rx, ry, rz); p.castShadow = true; g.add(p); return p; };
  const r = () => (rand() - 0.5);
  if (pose === 'lying') {
    part(m.geo.torso, cloth, 0, 0.17, 0, Math.PI / 2, 0, r() * 0.3);
    part(m.geo.head, m.skin, 0, 0.14, -0.52 + r() * 0.05, 0, 0, 0).scale.set(1, 0.9, 1.1);
    for (const s of [-1, 1]) {
      part(m.geo.limb, cloth, s * 0.28, 0.1, -0.18, Math.PI / 2, 0, s * (0.6 + rand() * 1.1));   // upper arm
      part(m.geo.limb, m.skin, s * (0.5 + rand() * 0.15), 0.07, -0.05 + r() * 0.3, Math.PI / 2 + r(), 0, s * rand() * 1.4);
      part(m.geo.limb, cloth, s * 0.1, 0.1, 0.45, Math.PI / 2, 0, s * rand() * 0.4);            // thigh
      part(m.geo.limb, cloth, s * (0.13 + rand() * 0.15), 0.08, 0.85, Math.PI / 2 + r() * 0.3, 0, s * rand() * 0.5);
    }
  } else if (pose === 'hanging') {
    part(m.geo.torso, cloth, 0, 0, 0, 0.1, 0, 0);
    part(m.geo.head, m.skin, 0, 0.4, 0.06, 0.6, 0, 0.3);       // head slumped
    for (const s of [-1, 1]) {
      part(m.geo.limb, cloth, s * 0.23, 0.02, 0, 0, 0, s * 0.12);
      part(m.geo.limb, m.skin, s * 0.26, -0.36, 0.03, 0.1, 0, s * 0.05);
      part(m.geo.limb, cloth, s * 0.09, -0.56, 0, 0.05, 0, 0);
      part(m.geo.limb, cloth, s * 0.1, -0.96, 0.04, 0.12, 0, 0);
    }
  } else { // sitting slumped against a wall
    part(m.geo.torso, cloth, 0, 0.42, 0.05, -0.35, 0, r() * 0.3);
    part(m.geo.head, m.skin, 0.05, 0.82, 0.2, 0.9, 0, 0.5);
    for (const s of [-1, 1]) {
      part(m.geo.limb, cloth, s * 0.25, 0.4, 0.12, 0.3, 0, s * 0.3);
      part(m.geo.limb, m.skin, s * 0.32, 0.12, 0.3, 1.3, 0, s * 0.2);
      part(m.geo.limb, cloth, s * 0.1, 0.1, 0.35, Math.PI / 2, 0, s * 0.15);
      part(m.geo.limb, cloth, s * 0.14, 0.1, 0.78, Math.PI / 2, 0, s * 0.2);
    }
  }
  return g;
}

function bloodPool(x, z, size, rand) {
  const p = new THREE.Mesh(mats().geo.plane, mats().blood);
  p.rotation.set(-Math.PI / 2, 0, rand() * 6); p.position.set(x, 0.012, z); p.scale.set(size, size, 1); p.receiveShadow = true;
  return p;
}

function skullPile(rand) {
  const m = mats(), g = new THREE.Group(), n = 4 + Math.floor(rand() * 7);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group();
    const cr = new THREE.Mesh(m.geo.skull, m.bone); cr.scale.set(1, 1.05, 1.2); s.add(cr);
    const j = new THREE.Mesh(m.geo.jaw, m.bone); j.position.set(0, -0.08, -0.06); s.add(j);
    const a = rand() * 6.28, d = rand() * 0.35, layer = i > 5 ? 0.16 : 0;
    s.position.set(Math.cos(a) * d, 0.09 + layer, Math.sin(a) * d); s.rotation.set(r(rand) * 0.6, rand() * 6, r(rand) * 0.6);
    s.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(s);
  }
  return g;
}
const r = rand => rand() - 0.5;

function chain(len) {
  const m = mats(), g = new THREE.Group(), n = Math.ceil(len / 0.085);
  for (let i = 0; i < n; i++) { const l = new THREE.Mesh(m.geo.link, m.iron); l.position.y = -i * 0.085; l.rotation.y = i % 2 ? Math.PI / 2 : 0; l.rotation.x = Math.PI / 2; g.add(l); }
  return g;
}

function cage(rand, withBody) {
  const m = mats(), g = new THREE.Group();
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28, b = new THREE.Mesh(m.geo.bar, m.iron); b.position.set(Math.cos(a) * 0.6, 1.1, Math.sin(a) * 0.6); b.castShadow = true; g.add(b); }
  for (const y of [0.02, 2.2]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 24), m.iron); ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring); }
  if (withBody) { const b = buildBody(rand, 'sitting'); b.scale.setScalar(0.9); b.rotation.y = rand() * 6; g.add(b); }
  return g;
}

function candles(rand) {
  const m = mats(), g = new THREE.Group(), n = 3 + Math.floor(rand() * 6), flames = [];
  for (let i = 0; i < n; i++) {
    const h = 0.4 + rand() * 0.8, c = new THREE.Mesh(m.geo.candle, m.wax);
    c.scale.y = h; c.position.set(r(rand) * 0.6, 0.15 * h, r(rand) * 0.6); g.add(c);
    const f = new THREE.Sprite(m.flame); f.scale.set(0.09, 0.18, 1); f.position.set(c.position.x, 0.3 * h + 0.08, c.position.z);
    f.userData.phase = rand() * 10; g.add(f); flames.push(f);
  }
  return { g, flames };
}

const WRITING = ['IT SEES YOU', 'NO WAY OUT', 'THEY FEED', 'DO NOT DESCEND', 'WE WERE 40', 'LIGHTS OFF', 'HUNGRY', 'TURN BACK'];

/**
 * Dress a generated level. theme: 'vault' | 'undercroft'.
 * Returns { group, update(t) } for animated bits (hanging bodies sway, candles flicker).
 */
export function decorate(L, theme, rand, CELL, WALL_H, gore) {
  const m = mats(), group = new THREE.Group(), flames = [], swingers = [];
  const horror = theme === 'undercroft';
  const floorAt = r2 => {
    for (let t = 0; t < 30; t++) {
      const x = r2.x + Math.floor(rand() * r2.w), y = r2.y + Math.floor(rand() * r2.h);
      if (L.grid[y * L.W + x] === 0) return new THREE.Vector3(x * CELL + CELL / 2 + r(rand) * 2.4, 0, y * CELL + CELL / 2 + r(rand) * 2.4);
    }
    return null;
  };
  const wallFacing = r2 => { // a floor cell against a wall, with the wall's direction
    for (let t = 0; t < 40; t++) {
      const x = r2.x + Math.floor(rand() * r2.w), y = r2.y + Math.floor(rand() * r2.h);
      if (L.grid[y * L.W + x] !== 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (L.grid[(y + dy) * L.W + x + dx] === 1) return { x, y, dx, dy };
    }
    return null;
  };
  const rooms = L.rooms.slice(1);
  for (const room of rooms) {
    // bodies
    const nb = gore ? (horror ? 1 + Math.floor(rand() * 3) : Math.floor(rand() * 2.2)) : 0;
    for (let i = 0; i < nb; i++) {
      const w = rand() < 0.4 ? wallFacing(room) : null;
      if (w) {
        const b = buildBody(rand, 'sitting');
        b.position.set(w.x * CELL + CELL / 2 + w.dx * (CELL / 2 - 0.35), 0, w.y * CELL + CELL / 2 + w.dy * (CELL / 2 - 0.35));
        b.rotation.y = Math.atan2(w.dx, w.dy) + Math.PI;
        group.add(b); group.add(bloodPool(b.position.x - w.dx * 0.3, b.position.z - w.dy * 0.3, 1.2 + rand(), rand));
      } else {
        const p = floorAt(room); if (!p) continue;
        const b = buildBody(rand, 'lying'); b.position.copy(p); b.rotation.y = rand() * 6.28;
        group.add(b); group.add(bloodPool(p.x, p.z, 1.6 + rand() * 1.4, rand));
      }
    }
    // extra blood on floor and walls
    if (gore) for (let i = 0; i < (horror ? 4 : 2); i++) { const p = floorAt(room); if (p) group.add(bloodPool(p.x, p.z, 0.6 + rand() * 1.2, rand)); }
    if (gore) for (let i = 0; i < (horror ? 3 : 1); i++) {
      const w = wallFacing(room); if (!w) continue;
      const s = new THREE.Mesh(m.geo.plane, m.bloodWall), size = 0.8 + rand() * 1.6;
      s.position.set(w.x * CELL + CELL / 2 + w.dx * (CELL / 2 - 0.01), 0.4 + rand() * 2.6, w.y * CELL + CELL / 2 + w.dy * (CELL / 2 - 0.01) + (w.dx ? r(rand) * 2 : 0));
      if (!w.dx) s.position.x += r(rand) * 2;
      s.lookAt(s.position.x - w.dx, s.position.y, s.position.z - w.dy); s.rotateZ(rand() * 6); s.scale.set(size, size, 1);
      group.add(s);
    }
    if (!horror) continue;
    // hanging bodies on chains
    if (gore && rand() < 0.55) {
      const p = floorAt(room); if (p) {
        const hang = new THREE.Group(); hang.position.set(p.x, WALL_H, p.z);
        const len = 1.1 + rand() * 0.8; hang.add(chain(len));
        const body = buildBody(rand, 'hanging'); body.position.y = -len - 0.35; hang.add(body);
        hang.userData.phase = rand() * 6; hang.userData.amp = 0.03 + rand() * 0.05;
        group.add(hang); swingers.push(hang);
        group.add(bloodPool(p.x, p.z, 0.8 + rand() * 0.6, rand));
      }
    }
    if (rand() < 0.3) { const p = floorAt(room); if (p) { const c = cage(rand, gore && rand() < 0.7); c.position.copy(p); group.add(c); } }
    for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) { const w = wallFacing(room); if (!w) continue; const sp = skullPile(rand); sp.position.set(w.x * CELL + CELL / 2 + w.dx * 1.4, 0, w.y * CELL + CELL / 2 + w.dy * 1.4); group.add(sp); }
    for (let i = 0; i < 2; i++) {
      const w = wallFacing(room); if (!w) continue;
      const c = candles(rand); c.g.position.set(w.x * CELL + CELL / 2 + w.dx * 1.5, 0, w.y * CELL + CELL / 2 + w.dy * 1.5);
      group.add(c.g); flames.push(...c.flames);
    }
  }
  // scrawled messages
  if (gore) for (let i = 0; i < (horror ? 3 : 1); i++) {
    const room = rooms[Math.floor(rand() * rooms.length)], w = room && wallFacing(room); if (!w) continue;
    const mat = new THREE.MeshStandardMaterial({ map: writingSprite(WRITING[Math.floor(rand() * WRITING.length)]), color: 0x6a0606, transparent: true, roughness: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const s = new THREE.Mesh(m.geo.plane, mat);
    s.position.set(w.x * CELL + CELL / 2 + w.dx * (CELL / 2 - 0.02), 2.2, w.y * CELL + CELL / 2 + w.dy * (CELL / 2 - 0.02));
    s.lookAt(s.position.x - w.dx, s.position.y, s.position.z - w.dy); s.scale.set(3.2, 0.8, 1);
    group.add(s);
  }
  return {
    group,
    update(t) {
      for (const f of flames) { const k = 1 + Math.sin(t * 13 + f.userData.phase) * 0.12 + Math.sin(t * 31 + f.userData.phase) * 0.08; f.scale.set(0.09 * k, 0.18 * k, 1); }
      for (const s of swingers) { s.rotation.z = Math.sin(t * 0.9 + s.userData.phase) * s.userData.amp; s.rotation.x = Math.cos(t * 0.7 + s.userData.phase) * s.userData.amp * 0.6; }
    },
  };
}
