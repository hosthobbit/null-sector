// The Glitchborn: Skitter, Sentinel, Colossus and The Archivist (boss).
import * as THREE from 'three';
import { moveCircle } from './physics.js';
import { skinTextures } from './textures.js';

const TYPES = {
  skitter:  { hp: 45,   speed: 7.2, radius: 0.55, height: 0.7, dmg: 11, reach: 1.5, score: 100, eye: 0xff2e88, body: 0x2a2f38 },
  sentinel: { hp: 75,   speed: 3.6, radius: 0.6,  height: 2.0, dmg: 14, reach: 22,  score: 150, eye: 0x38f2ff, body: 0x1d222c },
  colossus: { hp: 340,  speed: 3.1, radius: 1.05, height: 1.4, dmg: 32, reach: 2.6, score: 400, eye: 0xffa640, body: 0x262a31 },
  archivist:{ hp: 2400, speed: 2.2, radius: 1.8,  height: 3.0, dmg: 18, reach: 30,  score: 3000, eye: 0xff2e88, body: 0x14171e },
  // --- organic monsters (the Undercroft) ---
  ghoul:    { hp: 70,   speed: 6.4, radius: 0.5,  height: 1.0, dmg: 14, reach: 1.8, score: 120, eye: 0xffe070, organic: true, skin: [150, 158, 140] },
  crawler:  { hp: 55,   speed: 3.4, radius: 0.55, height: 0.45, dmg: 12, reach: 1.6, score: 110, eye: 0xff3030, organic: true, skin: [170, 140, 130] },
  butcher:  { hp: 420,  speed: 3.0, radius: 1.0,  height: 1.4, dmg: 34, reach: 2.8, score: 450, eye: 0xff4020, organic: true, skin: [175, 120, 105] },
  wraith:   { hp: 85,   speed: 3.4, radius: 0.6,  height: 1.9, dmg: 15, reach: 24,  score: 170, eye: 0x9dff4a, organic: true, skin: [120, 125, 118] },
  hollowking:{ hp: 2800, speed: 2.6, radius: 1.9, height: 2.6, dmg: 40, reach: 4.2, score: 3500, eye: 0xff2010, organic: true, skin: [160, 110, 100], boss: true },
};

const SKIN = {};
function skinMat(t) {
  const key = t.skin.join(',');
  if (!SKIN[key]) SKIN[key] = skinTextures(t.skin);
  const m = new THREE.MeshStandardMaterial({ ...SKIN[key], color: 0x8c877c, roughness: 0.55, metalness: 0.02 });
  m.normalScale.set(2.2, 2.2);
  return m;
}
const darkMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
/** A limb pivot: group at the joint, capsule hanging down from it. */
function limb(parent, x, y, z, r, len, mat) {
  const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat); m.position.y = -len / 2; j.add(m);
  return j;
}
function claws(parent, y, mat) {
  for (let i = -1; i <= 1; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.2, 5), mat); c.position.set(i * 0.035, y - 0.08, -0.02); c.rotation.x = Math.PI + 0.3; parent.add(c); }
}

const metal = (c, r = 0.4) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.8, roughness: r });
const glow = (c, i = 3) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i });

function buildSkitter(t) {
  const g = new THREE.Group(), body = metal(t.body, 0.35), eye = glow(t.eye, 4);
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), body); torso.scale.set(1, 0.6, 1.3); torso.position.y = 0.55; g.add(torso);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), body); head.position.set(0, 0.62, -0.5); g.add(head);
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eye); e1.position.set(-0.09, 0.67, -0.66); g.add(e1);
  const e2 = e1.clone(); e2.position.x = 0.09; g.add(e2);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.7), eye); spine.position.set(0, 0.8, -0.05); g.add(spine);
  const legs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Group(); leg.position.set(x * 0.35, 0.55, z * 0.3);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.55), body); upper.position.set(x * 0.2, 0.08, 0); upper.rotation.y = x * 0.9; leg.add(upper);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), body); lower.position.set(x * 0.4, -0.2, z * 0.05); lower.rotation.z = x * 0.35; leg.add(lower);
    g.add(leg); legs.push(leg);
  }
  return { g, glows: [eye], anim(tm, moving) { legs.forEach((l, i) => { l.rotation.x = Math.sin(tm * 18 + i * 1.6) * (moving ? 0.5 : 0.08); }); torso.position.y = 0.55 + Math.abs(Math.sin(tm * 18)) * (moving ? 0.05 : 0.01); } };
}

function buildSentinel(t) {
  const g = new THREE.Group(), body = metal(t.body, 0.25), eye = glow(t.eye, 5), ringMat = glow(0xff2e88, 2);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), body); shell.position.y = 1.9; g.add(shell);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), eye); lens.position.set(0, 1.9, -0.4); g.add(lens);
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.035, 8, 40), ringMat); r1.position.y = 1.9; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.03, 8, 40), glow(t.eye, 2)); r2.position.y = 1.9; g.add(r2);
  for (let i = 0; i < 3; i++) { const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 4), body); const a = i / 3 * Math.PI * 2; fin.position.set(Math.cos(a) * 0.45, 1.5, Math.sin(a) * 0.45); fin.rotation.x = Math.PI; g.add(fin); }
  return { g, glows: [eye, ringMat], anim(tm) { r1.rotation.x = tm * 1.4; r1.rotation.y = tm * 0.7; r2.rotation.y = -tm * 2; r2.rotation.z = tm;  } };
}

function buildColossus(t) {
  const g = new THREE.Group(), body = metal(t.body, 0.5), plate = metal(0x3a404b, 0.3), core = glow(t.eye, 5);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.0), body); torso.position.y = 1.9; g.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.15), plate); chest.position.set(0, 2.0, -0.55); g.add(chest);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), core); orb.position.set(0, 2.0, -0.65); g.add(orb);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.5), plate); head.position.set(0, 2.78, -0.2); g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.05), core); visor.position.set(0, 2.8, -0.46); g.add(visor);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.98, 2.35, 0);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.6), plate); arm.add(shoulder);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.42), body); fore.position.y = -0.85; arm.add(fore);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), plate); fist.position.y = -1.55; arm.add(fist);
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.06), core); knuckle.position.set(0, -1.5, -0.27); arm.add(knuckle);
    g.add(arm); arms.push(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.55), body); leg.position.set(s * 0.42, 0.65, 0); g.add(leg); legs.push(leg);
  }
  return { g, glows: [core], anim(tm, moving, charging) { const sp = charging ? 14 : 6; arms.forEach((a, i) => (a.rotation.x = Math.sin(tm * sp + i * Math.PI) * (moving ? 0.5 : 0.05))); legs.forEach((l, i) => (l.rotation.x = Math.sin(tm * sp + i * Math.PI) * (moving ? 0.4 : 0))); orb.scale.setScalar(1 + Math.sin(tm * 6) * 0.12); } };
}

function buildArchivist(t) {
  const g = new THREE.Group(), body = metal(t.body, 0.2), eye = glow(t.eye, 2.2), cy = glow(0x38f2ff, 1.2);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 2), body); shell.position.y = 3.2; g.add(shell);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), eye); iris.position.set(0, 3.2, -1.15); iris.scale.z = 0.5; g.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 })); pupil.position.set(0, 3.2, -1.45); g.add(pupil);
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.3 + i * 0.45, 0.06, 8, 64), i === 1 ? eye : cy); r.position.y = 3.2; g.add(r); rings.push(r); }
  const shards = [];
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), cy); g.add(s); shards.push(s); }
  const light = new THREE.PointLight(t.eye, 12, 12, 1.8); light.position.set(0, 3.2, -1.8); g.add(light);
  return { g, glows: [eye, cy], anim(tm) { rings.forEach((r, i) => { r.rotation.x = tm * (0.4 + i * 0.3); r.rotation.y = tm * (0.6 - i * 0.2); }); shards.forEach((s, i) => { const a = tm * 0.8 + i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 3.4, 3.2 + Math.sin(tm * 2 + i) * 0.6, Math.sin(a) * 3.4); s.rotation.y = tm * 3; }); shell.rotation.y = tm * 0.2; } };
}

function buildGhoul(t) {
  const g = new THREE.Group(), skin = skinMat(t), eye = glow(t.eye, 3), dark = darkMat(0x1a1210), nail = darkMat(0x2a2420);
  const hips = new THREE.Group(); hips.position.y = 1.0; g.add(hips);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), skin); pelvis.scale.set(1.2, 0.8, 0.9); hips.add(pelvis);
  const spine = new THREE.Group(); spine.rotation.x = -0.55; hips.add(spine);        // hunched forward
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 4, 12), skin); chest.position.y = 0.36; chest.scale.set(1, 1, 0.75); spine.add(chest);
  for (let i = 0; i < 5; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 4, 16, Math.PI), dark); rib.position.set(0, 0.22 + i * 0.07, 0.01); rib.rotation.set(Math.PI / 2, 0, 0); rib.scale.set(1, 0.78, 1); spine.add(rib); }
  const neck = new THREE.Group(); neck.position.y = 0.66; spine.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), skin); head.scale.set(0.85, 1.05, 1.2); head.position.set(0, 0.12, -0.06); neck.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.16), skin); jaw.position.set(0, 0.0, -0.13); neck.add(jaw);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x1a0000 })); mouth.position.set(0, 0.04, -0.22); neck.add(mouth);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eye); e.position.set(s * 0.05, 0.15, -0.21); neck.add(e); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = limb(spine, s * 0.25, 0.56, 0, 0.055, 0.42, skin); sh.rotation.z = s * 0.2;
    const el = limb(sh, 0, -0.5, 0, 0.045, 0.46, skin); el.rotation.x = -0.5; claws(el, -0.56, nail);
    arms.push([sh, el]);
    const hip = limb(hips, s * 0.13, -0.05, 0, 0.07, 0.42, skin);
    const knee = limb(hip, 0, -0.5, 0, 0.055, 0.4, skin); knee.rotation.x = 0.35;
    legs.push([hip, knee]);
  }
  return { g, glows: [eye], jaw, anim(tm, moving, _c, attacking) {
    const sp = moving ? 13 : 2, a = moving ? 0.8 : 0.08;
    legs.forEach(([h, k], i) => { const ph = tm * sp + i * Math.PI; h.rotation.x = Math.sin(ph) * a; k.rotation.x = 0.3 + Math.max(0, -Math.cos(ph)) * a * 1.2; });
    arms.forEach(([s, e], i) => { const ph = tm * sp + i * Math.PI; s.rotation.x = attacking ? -1.9 + Math.sin(tm * 20) * 0.4 : -Math.sin(ph) * a * 0.9 - 0.2; e.rotation.x = -0.5 - Math.abs(Math.sin(ph)) * 0.4; });
    hips.position.y = 1.0 + Math.abs(Math.sin(tm * sp)) * (moving ? 0.07 : 0.01);
    spine.rotation.x = -0.55 - (moving ? 0.15 : 0) + Math.sin(tm * 1.7) * 0.03; neck.rotation.x = 0.4 + Math.sin(tm * 3.1) * 0.06; jaw.position.y = attacking ? -0.04 : 0;
  } };
}

function buildCrawler(t) {
  const g = new THREE.Group(), skin = skinMat(t), eye = glow(t.eye, 3), gut = new THREE.MeshStandardMaterial({ color: 0x6a1010, roughness: 0.25 });
  const body = new THREE.Group(); body.position.y = 0.32; g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 12), skin); torso.rotation.x = Math.PI / 2 - 0.25; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), skin); head.position.set(0, 0.22, -0.46); head.scale.set(0.9, 1, 1.1); body.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eye); e.position.set(s * 0.05, 0.25, -0.58); body.add(e); }
  for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 - i * 0.006, 0.18, 3, 6), gut); e.position.set(Math.sin(i * 2) * 0.06, -0.12, 0.38 + i * 0.16); e.rotation.x = Math.PI / 2 + Math.sin(i) * 0.4; body.add(e); }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = limb(body, s * 0.24, 0.08, -0.3, 0.05, 0.36, skin);
    const el = limb(sh, 0, -0.42, 0, 0.042, 0.36, skin); claws(el, -0.44, darkMat(0x2a2420));
    arms.push([sh, el]);
  }
  return { g, glows: [eye], anim(tm, moving) {
    const sp = moving ? 6 : 1.5;
    arms.forEach(([s, e], i) => { const ph = tm * sp + i * Math.PI; s.rotation.x = -1.2 + Math.sin(ph) * 0.7; s.rotation.z = (i ? 1 : -1) * 0.35; e.rotation.x = -0.6 - Math.max(0, Math.cos(ph)) * 0.8; });
    body.rotation.z = Math.sin(tm * sp) * 0.08; body.position.y = 0.32 + Math.abs(Math.sin(tm * sp)) * 0.04; head.rotation.y = Math.sin(tm * 2.3) * 0.3;
  } };
}

function buildButcher(t, scale = 1) {
  const g = new THREE.Group(), skin = skinMat(t), eye = glow(t.eye, 3), horn = darkMat(0x2a2218), steel = new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.9, roughness: 0.35 }), apron = darkMat(0x3a2a20);
  const root = new THREE.Group(); root.scale.setScalar(scale); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 1.2; root.add(hips);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 16), skin); belly.position.set(0, 0.45, -0.05); belly.scale.set(1, 1.05, 0.95); hips.add(belly);
  const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.9, 16, 1, true, -0.9, 1.8), apron); ap.position.set(0, 0.2, 0); ap.rotation.y = Math.PI; hips.add(ap);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), skin); chest.position.set(0, 1.05, 0.05); chest.scale.set(1.25, 0.8, 0.9); hips.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), skin); head.position.set(0, 1.5, -0.25); hips.add(head);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.5, 8), horn); h.position.set(s * 0.18, 1.72, -0.22); h.rotation.set(-0.4, 0, s * -0.7); hips.add(h);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eye); e.position.set(s * 0.08, 1.54, -0.46); hips.add(e);
  }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const sh = limb(hips, s * 0.78, 1.2, 0, 0.16, 0.55, skin); sh.rotation.z = s * 0.3;
    const el = limb(sh, 0, -0.7, 0, 0.14, 0.55, skin);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skin); fist.position.y = -0.75; el.add(fist);
    if (s === 1) { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.45), steel); blade.position.set(0, -1.05, -0.18); el.add(blade); }
    arms.push([sh, el]);
    const hip = limb(hips, s * 0.32, -0.1, 0, 0.17, 0.5, skin);
    const kn = limb(hip, 0, -0.6, 0, 0.14, 0.4, skin);
    legs.push([hip, kn]);
  }
  return { g, glows: [eye], anim(tm, moving, charging, attacking) {
    const sp = charging ? 11 : moving ? 5 : 1.2, a = moving ? 0.45 : 0.05;
    legs.forEach(([h, k], i) => { const ph = tm * sp + i * Math.PI; h.rotation.x = Math.sin(ph) * a; k.rotation.x = Math.max(0, -Math.cos(ph)) * a; });
    arms.forEach(([s, e], i) => { const ph = tm * sp + i * Math.PI; s.rotation.x = attacking ? -2.4 : -Math.sin(ph) * a * 0.8; e.rotation.x = attacking ? -0.8 : -0.25; });
    belly.scale.y = 1.05 + Math.sin(tm * 2) * 0.02; hips.position.y = 1.2 + Math.abs(Math.sin(tm * sp)) * (moving ? 0.06 : 0);
  } };
}

function buildWraith(t) {
  const g = new THREE.Group(), skin = skinMat(t), eye = glow(t.eye, 4), robe = new THREE.MeshStandardMaterial({ color: 0x16120f, roughness: 1, side: THREE.DoubleSide });
  const body = new THREE.Group(); body.position.y = 0.5; g.add(body);
  const cloakGeo = new THREE.ConeGeometry(0.55, 2.1, 18, 8, true);
  const pos = cloakGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < -0.6) { pos.setX(i, pos.getX(i) * (1 + Math.sin(i * 7.3) * 0.25)); pos.setZ(i, pos.getZ(i) * (1 + Math.cos(i * 3.1) * 0.25)); pos.setY(i, y - Math.abs(Math.sin(i * 2.7)) * 0.35); } }
  cloakGeo.computeVertexNormals();
  const cloak = new THREE.Mesh(cloakGeo, robe); cloak.position.y = 0.9; body.add(cloak);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), robe); hood.position.set(0, 1.95, 0); hood.rotation.x = -0.35; body.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skin); face.position.set(0, 1.86, -0.08); face.scale.set(0.8, 1, 0.9); body.add(face);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eye); e.position.set(s * 0.055, 1.9, -0.2); body.add(e); }
  const arms = [];
  for (const s of [-1, 1]) { const sh = limb(body, s * 0.3, 1.6, -0.05, 0.035, 0.5, skin); const el = limb(sh, 0, -0.56, 0, 0.03, 0.45, skin); claws(el, -0.5, darkMat(0x222018)); arms.push([sh, el]); }
  return { g, glows: [eye], anim(tm, moving, _c, attacking) {
    body.position.y = 0.5 + Math.sin(tm * 1.8) * 0.12;
    arms.forEach(([s, e], i) => { s.rotation.x = attacking ? -2.2 : -0.9 + Math.sin(tm * 1.5 + i) * 0.25; s.rotation.z = (i ? 1 : -1) * 0.5; e.rotation.x = -0.6 + Math.sin(tm * 2 + i) * 0.2; });
    cloak.rotation.y = Math.sin(tm * 0.8) * 0.2;
  } };
}

const BUILDERS = { skitter: buildSkitter, sentinel: buildSentinel, colossus: buildColossus, archivist: buildArchivist,
  ghoul: buildGhoul, crawler: buildCrawler, butcher: t => buildButcher(t), wraith: buildWraith, hollowking: t => buildButcher(t, 1.75) };

export class Enemy {
  constructor(type, pos, scene, depth) {
    this.type = type; this.t = TYPES[type];
    const scale = 1 + (depth - 1) * 0.12;
    this.maxHp = this.hp = Math.round(this.t.hp * scale);
    this.pos = pos.clone(); this.pos.y = 0;
    this.vel = new THREE.Vector3();
    this.model = BUILDERS[type](this.t);
    this.mesh = this.model.g; this.mesh.position.copy(this.pos);
    this.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.enemy = this; } });
    scene.add(this.mesh);
    // invisible hitbox for reliable raycasts
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(this.t.radius, this.t.radius, type === 'sentinel' ? 1.2 : type === 'archivist' ? 3.6 : this.t.height * 2, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hb.position.y = type === 'sentinel' ? 1.9 : type === 'archivist' ? 3.2 : this.t.height;
    hb.userData.enemy = this; hb.userData.hitbox = true;
    this.mesh.add(hb); this.hitbox = hb;
    this.state = 'idle'; this.cool = 1 + Math.random(); this.flash = 0; this.dead = false; this.dying = 0;
    this.alertT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strafeT = 0; this.tm = Math.random() * 10;
    this.charge = 0; this.windup = 0; this.spawnT = 0; this.path = null; this.pathT = 0; this.lungeT = 0;
    this.depth = depth; this.organic = !!this.t.organic; this.attackT = 0;
  }

  get centre() { return new THREE.Vector3(this.pos.x, this.hitbox.position.y, this.pos.z); }

  damage(n, game, fromDir, opts = {}) {
    if (this.dead) return false;
    this.hp -= n; this.flash = 0.1; this.lastOpts = opts;
    if (this.state === 'idle') this.alert(game);
    if (fromDir && this.type !== 'archivist') this.vel.addScaledVector(fromDir, this.type === 'colossus' ? 0.5 : 3);
    if (this.hp <= 0) { this.die(game); return true; }
    return false;
  }

  alert(game) { if (this.state !== 'idle') return; this.state = 'chase'; game.audio.alert(); }

  die(game) {
    this.dead = true; this.dying = 0.6;
    const o = this.lastOpts || {};
    if (this.organic) {
      const floor = new THREE.Vector3(this.pos.x, 0.01, this.pos.z);
      this.gibbed = game.fx.gore && (o.gib || o.explosive || -this.hp > 55) && !this.t.boss;
      game.fx.bloodSpray(this.centre, new THREE.Vector3(0, 1, 0), this.gibbed ? 60 : 24, this.gibbed ? 8 : 4);
      game.fx.bloodSplat(floor, new THREE.Vector3(0, 1, 0), this.gibbed ? 2.8 : 2 + this.t.radius);
      if (this.gibbed) { game.fx.gibBurst(this.centre, this.t.boss ? 30 : 12, 7); game.scene.remove(this.mesh); this.dying = 0.01; }
      else this.dying = 0.55;
      game.audio.squelch?.();
    }
    this.hitbox.visible = false;
    game.onEnemyKilled(this);
  }

  update(dt, game) {
    const lvl = game.level, player = game.player;
    this.tm += dt;
    if (this.dying > 0 && this.organic && this.type !== 'wraith') {
      this.dying -= dt;
      if (this.gibbed) { if (this.dying <= 0) this.removed = true; return; }
      const k = 1 - Math.max(0, this.dying / 0.55);
      this.mesh.rotation.x = -k * k * Math.PI / 2 * (this.type === 'crawler' ? 0.15 : 1);
      this.mesh.position.y = -k * 0.1;
      this.model.anim(this.tm, false, false, false);
      if (this.dying <= 0) { this.removed = true; this.corpse = true; game.addCorpse(this); }
      return;
    }
    if (this.dying > 0) {
      this.dying -= dt;
      const k = Math.max(0, this.dying / 0.6);
      this.mesh.scale.set(1 + (1 - k) * 0.4, k, 1 + (1 - k) * 0.4);
      this.mesh.rotation.y += dt * 8;
      if (Math.random() < 0.6) game.fx.spawn(this.centre.add(new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.5), (Math.random() - 0.5) * 1.5)), new THREE.Vector3(0, 3, 0), this.t.eye, 0.25, 0.5, -1, 1);
      if (this.dying <= 0) { game.scene.remove(this.mesh); this.removed = true; }
      return;
    }
    const toP = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = toP.length(); toP.normalize();
    const sees = dist < 38 && lvl.los(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
    if (this.state === 'idle') {
      if (sees && dist < 24) this.alert(game);
      this.model.anim(this.tm, false, false); this.applyFlash(dt);
      return;
    }
    if (sees) this.lastSeen = player.pos.clone();

    let move = new THREE.Vector3(), speed = this.t.speed, facing = toP;
    const chaseDir = () => {
      if (sees && dist < 16) return toP.clone();
      const step = lvl.nextStep(this.pos.x, this.pos.z);
      return step ? new THREE.Vector3(step.x - this.pos.x, 0, step.z - this.pos.z).normalize() : toP.clone();
    };

    switch (this.type) {
      case 'skitter': {
        this.cool -= dt; this.lungeT -= dt;
        if (dist < this.t.reach + player.radius && this.cool <= 0) { game.hurtPlayer(this.t.dmg, this.pos); this.cool = 0.9; this.vel.addScaledVector(toP, -4); }
        else if (sees && dist < 7 && dist > 2.5 && this.lungeT <= 0) { this.vel.addScaledVector(toP, 12); this.lungeT = 2.4; }
        move = chaseDir(); if (dist < 1.2) move.set(0, 0, 0);
        break;
      }
      case 'ghoul': case 'crawler': {
        this.cool -= dt; this.lungeT -= dt; this.attackT -= dt;
        if (dist < this.t.reach + player.radius && this.cool <= 0) { game.hurtPlayer(this.t.dmg, this.pos); this.cool = 1.0; this.attackT = 0.35; game.audio.growl(this.type === 'ghoul' ? 1.4 : 1.1); }
        else if (this.type === 'ghoul' && sees && dist < 8 && dist > 3 && this.lungeT <= 0) { this.vel.addScaledVector(toP, 11); this.lungeT = 2.8; this.attackT = 0.5; game.audio.shriek?.(); }
        if (Math.random() < dt * 0.15) game.audio.growl(this.type === 'ghoul' ? 1.3 : 0.9);
        move = chaseDir(); if (dist < 1.1) move.set(0, 0, 0);
        break;
      }
      case 'wraith': {
        this.cool -= dt; this.strafeT -= dt; this.attackT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.5 + Math.random() * 1.5; }
        if (sees) {
          const side = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(this.strafe);
          move = dist > 15 ? toP.clone().add(side.multiplyScalar(0.5)) : dist < 9 ? toP.clone().negate().add(side) : side;
          if (this.cool <= 0) {
            const from = this.centre.add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(toP, 0.6);
            const flat = dist, speed = 15, tFlight = flat / speed;
            const dir = new THREE.Vector3(player.pos.x - from.x, 0, player.pos.z - from.z).normalize().multiplyScalar(speed);
            dir.y = (player.eye.y - 0.4 - from.y) / tFlight + 0.5 * 9 * tFlight;       // lob that arcs under gravity 9
            game.projectiles.fire(from, dir.clone().normalize(), { owner: 'enemy', speed: dir.length(), dmg: this.t.dmg, color: 0x9dff4a, size: 0.3, gravity: 9, acid: true });
            game.audio.spit?.(); this.cool = 1.7 + Math.random() - Math.min(this.depth * 0.05, 0.5); this.attackT = 0.4;
          }
        } else move = chaseDir();
        break;
      }
      case 'butcher': case 'hollowking': {
        this.cool -= dt; this.attackT -= dt;
        if (this.type === 'hollowking') { this.spawnT -= dt; if (this.spawnT <= 0) { game.spawnMinions(this.pos, this.hp < this.maxHp / 2 ? 4 : 2, 'ghoul'); this.spawnT = 10; game.audio.growl(0.35); } }
        const reach = this.t.reach;
        if (this.windup > 0) {
          this.windup -= dt; move.set(0, 0, 0); this.attackT = 0.2;
          if (this.windup <= 0) {
            const at = this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)).addScaledVector(toP, reach * 0.6);
            game.fx.explosion(at, 0xa83a1a, reach + 1.5); game.fx.bloodSplat(new THREE.Vector3(at.x, 0.01, at.z), new THREE.Vector3(0, 1, 0), 1.5);
            game.shake(this.t.boss ? 1.4 : 0.9); game.audio.explode();
            if (dist < reach + 1.4) game.hurtPlayer(this.t.dmg, this.pos, 10);
            this.cool = 1.6;
          }
        } else if (this.charge > 0) {
          this.charge -= dt; speed = this.t.speed * 3.2; move = this.chargeDir.clone();
          if (dist < reach) { game.hurtPlayer(this.t.dmg * 0.8, this.pos, 15); this.charge = 0; this.cool = 1.4; }
        } else if (dist < reach + 1 && this.cool <= 0) { this.windup = 0.6; game.audio.growl(0.5); }
        else if (sees && dist > 6 && dist < 20 && this.cool <= 0 && Math.random() < dt * 0.9) { this.charge = 1.2; this.chargeDir = toP.clone(); game.audio.growl(0.45); }
        else move = chaseDir();
        break;
      }
      case 'sentinel': {
        this.cool -= dt; this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 1.2 + Math.random() * 1.5; }
        if (sees) {
          const side = new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(this.strafe);
          move = dist > 14 ? toP.clone().add(side.multiplyScalar(0.6)) : dist < 8 ? toP.clone().negate().add(side) : side;
          if (this.cool <= 0) {
            const from = this.centre.add(toP.clone().multiplyScalar(0.7));
            const target = player.eye.clone().add(player.vel.clone().multiplyScalar(dist / 18 * 0.6));
            game.projectiles.fire(from, target.sub(from).normalize(), { owner: 'enemy', speed: 17, dmg: this.t.dmg, color: this.t.eye, size: 0.28 });
            game.audio.enemyShot(); this.cool = 1.4 + Math.random() * 1.1 - Math.min(this.depth * 0.06, 0.5);
          }
        } else move = chaseDir();
        break;
      }
      case 'colossus': {
        this.cool -= dt;
        if (this.windup > 0) {
          this.windup -= dt; move.set(0, 0, 0);
          if (this.windup <= 0) { // slam
            game.fx.explosion(this.pos.clone().add(new THREE.Vector3(0, 0.3, 0)).addScaledVector(toP, 1.4), 0xffa640, 5);
            game.shake(0.9); game.audio.explode();
            if (dist < 4.2) game.hurtPlayer(this.t.dmg, this.pos, 9);
            this.cool = 1.8;
          }
        } else if (this.charge > 0) {
          this.charge -= dt; speed = this.t.speed * 3.4; move = this.chargeDir.clone();
          if (dist < 2.2) { game.hurtPlayer(this.t.dmg * 0.8, this.pos, 14); this.charge = 0; this.cool = 1.5; }
        } else if (dist < this.t.reach + 1 && this.cool <= 0) { this.windup = 0.55; game.audio.growl(0.7); }
        else if (sees && dist > 6 && dist < 18 && this.cool <= 0 && Math.random() < dt * 0.8) { this.charge = 1.1; this.chargeDir = toP.clone(); game.audio.growl(0.6); }
        else move = chaseDir();
        break;
      }
      case 'archivist': {
        this.cool -= dt; this.spawnT -= dt; this.strafeT -= dt;
        if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = 2 + Math.random() * 2; }
        move = sees ? new THREE.Vector3(-toP.z, 0, toP.x).multiplyScalar(this.strafe).addScaledVector(toP, dist > 16 ? 0.7 : -0.4) : chaseDir();
        if (sees && this.cool <= 0) {
          const from = this.centre.add(toP.clone().multiplyScalar(1.6)), phase = this.hp < this.maxHp / 2;
          const n = phase ? 9 : 5;
          for (let i = 0; i < n; i++) {
            const a = (i - (n - 1) / 2) * 0.12;
            const dir = player.eye.clone().sub(from).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
            game.projectiles.fire(from, dir, { owner: 'enemy', speed: 15, dmg: this.t.dmg, color: i % 2 ? 0xff2e88 : 0x38f2ff, size: 0.34 });
          }
          game.audio.enemyShot(); this.cool = phase ? 1.3 : 2;
        }
        if (this.spawnT <= 0) { game.spawnMinions(this.pos, 2 + (this.hp < this.maxHp / 2 ? 2 : 0)); this.spawnT = 9; game.audio.growl(0.4); }
        break;
      }
    }

    // separation from other enemies
    for (const o of game.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), min = this.t.radius + o.t.radius;
      if (d < min && d > 0.001) move.add(new THREE.Vector3(dx / d, 0, dz / d).multiplyScalar((min - d) * 2));
    }
    if (move.lengthSq() > 0) move.normalize();
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
    const step = move.multiplyScalar(speed * dt).add(this.vel.clone().multiplyScalar(dt));
    moveCircle(this.pos, step.x, step.z, this.t.radius * 0.8, lvl);
    this.mesh.position.set(this.pos.x, this.type === 'sentinel' ? Math.sin(this.tm * 2) * 0.15 : 0, this.pos.z);
    if (this.organic && this.flash > 0.08 && Math.random() < 0.3) this.mesh.rotation.z = (Math.random() - 0.5) * 0.1; else if (this.organic) this.mesh.rotation.z *= 0.8;
    const yaw = Math.atan2(-facing.x, -facing.z);
    this.mesh.rotation.y += ((yaw - this.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
    this.model.anim(this.tm, move.lengthSq() > 0.01, this.charge > 0, this.attackT > 0);
    this.applyFlash(dt);
  }

  applyFlash(dt) {
    this.flash -= dt;
    const on = this.flash > 0;
    for (const m of this.model.glows) m.emissive.setHex(on ? 0xffffff : m.userData.base ?? (m.userData.base = m.emissive.getHex()));
  }
}

/** Choose a mix of enemies for a room based on sector depth. */
export function rollEnemy(rand, depth, theme = 'vault') {
  const r = rand();
  if (theme === 'undercroft') {
    if (depth >= 2 && r < 0.05 + depth * 0.015) return 'butcher';
    if (r < 0.5) return 'ghoul';
    if (r < 0.75) return 'crawler';
    return 'wraith';
  }
  if (depth >= 3 && r > 0.85) return 'ghoul';
  if (depth >= 2 && r < 0.12 + depth * 0.02) return 'colossus';
  if (r < 0.5) return 'skitter';
  return 'sentinel';
}
