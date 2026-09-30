// Procedural sector generator: rooms + corridors on a grid, built into instanced meshes.
import * as THREE from 'three';
import { wallTextures, floorTextures, ceilingTextures, glowSprite, stoneWallTextures, flagstoneTextures, flameSprite } from './textures.js';
import { decorate } from './horror.js';

export const CELL = 4;        // metres per grid cell
export const WALL_H = 5.2;
const W = 44, H = 44;

const PALETTES = [
  { name: 'cyan', light: 0x38f2ff, strip: 0x38f2ff },
  { name: 'magenta', light: 0xff2e88, strip: 0xff2e88 },
  { name: 'amber', light: 0xffa640, strip: 0xffb347 },
  { name: 'toxic', light: 0x7dff5a, strip: 0x5dff8f },
  { name: 'violet', light: 0x9b6bff, strip: 0xa58bff },
];

let TEX = null;
function textures() {
  if (!TEX) TEX = { wall: wallTextures(), floor: floorTextures(), ceil: ceilingTextures(), glow: glowSprite(), stone: stoneWallTextures(), flag: flagstoneTextures(), flame: flameSprite() };
  return TEX;
}

function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** 1 = wall, 2 = server rack (solid prop), 0 = floor */
function carve(rand, depth) {
  const grid = new Uint8Array(W * H).fill(1);
  const rooms = [];
  const target = 7 + Math.min(depth, 6);
  for (let tries = 0; tries < 400 && rooms.length < target; tries++) {
    const w = 4 + Math.floor(rand() * 6), h = 4 + Math.floor(rand() * 6);
    const x = 1 + Math.floor(rand() * (W - w - 2)), y = 1 + Math.floor(rand() * (H - h - 2));
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[y * W + x] = 0;
  // connect each room to its nearest already-connected room (a tree), plus a couple of loops
  const connected = [rooms[0]];
  const tunnel = (a, b, wide) => {
    let x = a.cx, y = a.cy;
    const horizFirst = rand() < 0.5;
    const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); grid[y * W + x] = 0; if (wide && y + 1 < H - 1) grid[(y + 1) * W + x] = 0; } };
    const stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); grid[y * W + x] = 0; if (wide && x + 1 < W - 1) grid[y * W + x + 1] = 0; } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  };
  for (const r of rooms.slice(1)) {
    const near = connected.reduce((best, c) => (Math.hypot(c.cx - r.cx, c.cy - r.cy) < Math.hypot(best.cx - r.cx, best.cy - r.cy) ? c : best));
    tunnel(near, r, rand() < 0.5);
    connected.push(r);
  }
  for (let i = 0; i < 2; i++) { const a = rooms[Math.floor(rand() * rooms.length)], b = rooms[Math.floor(rand() * rooms.length)]; if (a !== b) tunnel(a, b, false); }
  // server racks inside larger rooms (never blocking the centre)
  for (const r of rooms.slice(1)) {
    if (r.w < 6 || r.h < 6) continue;
    for (const [dx, dy] of [[1, 1], [r.w - 2, 1], [1, r.h - 2], [r.w - 2, r.h - 2]]) if (rand() < 0.6) grid[(r.y + dy) * W + r.x + dx] = 2;
  }
  return { grid, rooms };
}

function bfs(grid, sx, sy) {
  const dist = new Int32Array(W * H).fill(-1), q = [sy * W + sx];
  dist[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = (y + dy) * W + x + dx;
      if (grid[n] === 0 && dist[n] < 0) { dist[n] = dist[c] + 1; q.push(n); }
    }
  }
  return dist;
}

/** Sector 1 is the vault; after that the Undercroft (catacombs) alternates with the vault. */
export function themeFor(depth) { return depth === 1 ? 'vault' : depth % 2 === 0 ? 'undercroft' : 'vault'; }

export function buildLevel(scene, depth, quality, gore = true) {
  const seed = (Date.now() ^ (depth * 7919)) >>> 0;
  const rand = mulberry(seed);
  const { grid, rooms } = carve(rand, depth);
  const tex = textures();
  const group = new THREE.Group();
  const palette = { ...PALETTES[(depth - 1) % PALETTES.length] };
  const accent = { ...PALETTES[(depth + 1) % PALETTES.length] };
  const theme = themeFor(depth), horror = theme === 'undercroft';
  if (horror) { palette.light = 0xff7a2e; accent.light = 0xff2a1a; }

  // ---------- floor & ceiling ----------
  const floorMat = horror ? new THREE.MeshStandardMaterial({ ...tex.flag, color: 0xa89a8c, metalness: 0.05, roughness: 1 }) : new THREE.MeshStandardMaterial({ ...tex.floor, color: 0xb8c0cc, metalness: 0.55, roughness: 1 });
  floorMat.map.repeat.set(W / 2, H / 2); floorMat.normalMap.repeat.set(W / 2, H / 2); floorMat.roughnessMap.repeat.set(W / 2, H / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(W * CELL / 2, 0, H * CELL / 2); floor.receiveShadow = true;
  group.add(floor);
  const ceilMat = horror ? new THREE.MeshStandardMaterial({ ...tex.stone, color: 0x4a403a, metalness: 0, roughness: 1 }) : new THREE.MeshStandardMaterial({ ...tex.ceil, color: 0x8a92a0, metalness: 0.3, roughness: 1 });
  ceilMat.map.repeat.set(W / 2, H / 2); ceilMat.normalMap.repeat.set(W / 2, H / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W * CELL / 2, WALL_H, H * CELL / 2);
  group.add(ceil);

  // ---------- walls (only faces next to floor are needed; instanced cubes) ----------
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || grid[y * W + x] !== 0;
  const wallCells = [], rackCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = grid[y * W + x];
    if (v === 0) continue;
    const exposed = !solid(x + 1, y) || !solid(x - 1, y) || !solid(x, y + 1) || !solid(x, y - 1);
    if (!exposed) continue;
    (v === 2 ? rackCells : wallCells).push([x, y]);
  }
  const wallMat = horror ? new THREE.MeshStandardMaterial({ ...tex.stone, color: 0xb0a090, metalness: 0, roughness: 1 }) : new THREE.MeshStandardMaterial({ ...tex.wall, color: 0xc4ccd8, metalness: 0.6, roughness: 1 });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMat, wallCells.length);
  const m = new THREE.Matrix4();
  wallCells.forEach(([x, y], i) => { m.makeTranslation(x * CELL + CELL / 2, WALL_H / 2, y * CELL + CELL / 2); walls.setMatrixAt(i, m); });
  walls.castShadow = walls.receiveShadow = true;
  group.add(walls);

  // ---------- neon strips along corridor-facing walls ----------
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: palette.strip, emissiveIntensity: 1.8 });
  const stripGeo = new THREE.BoxGeometry(CELL * 0.92, 0.08, 0.08);
  const strips = new THREE.InstancedMesh(stripGeo, stripMat, wallCells.length * 2);
  let sn = 0;
  const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (const [x, y] of wallCells) {
    if (horror || rand() > 0.35) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (solid(x + dx, y + dy) || sn >= wallCells.length * 2) continue;
      const cx = x * CELL + CELL / 2 + dx * (CELL / 2 + 0.05), cz = y * CELL + CELL / 2 + dy * (CELL / 2 + 0.05);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx !== 0 ? Math.PI / 2 : 0);
      p.set(cx, rand() < 0.5 ? 0.35 : WALL_H - 0.5, cz);
      m.compose(p, q, s); strips.setMatrixAt(sn++, m);
      break;
    }
  }
  strips.count = sn;
  group.add(strips);

  // ---------- server racks with blinking LEDs ----------
  const rackMat = horror ? new THREE.MeshStandardMaterial({ ...tex.stone, color: 0x9a8a7c, roughness: 1 }) : new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.8, roughness: 0.35 });
  const rackGeo = horror ? new THREE.CylinderGeometry(CELL * 0.32, CELL * 0.38, WALL_H, 12) : new THREE.BoxGeometry(CELL * 0.8, WALL_H * 0.72, CELL * 0.8);
  const racks = new THREE.InstancedMesh(rackGeo, rackMat, Math.max(1, rackCells.length));
  rackCells.forEach(([x, y], i) => { m.makeTranslation(x * CELL + CELL / 2, horror ? WALL_H / 2 : WALL_H * 0.36, y * CELL + CELL / 2); racks.setMatrixAt(i, m); });
  racks.count = rackCells.length; racks.castShadow = true;
  group.add(racks);
  const ledGeo = new THREE.PlaneGeometry(0.12, 0.05);
  const leds = [];
  const ledColors = [palette.strip, accent.strip, 0xffffff, 0x5dff8f];
  for (const [x, y] of horror ? [] : rackCells) for (let k = 0; k < 18; k++) {
    const face = Math.floor(rand() * 4), [fx, fz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][face];
    const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: ledColors[Math.floor(rand() * 4)] }));
    led.position.set(x * CELL + CELL / 2 + fx * CELL * 0.401 + (fz ? (rand() - 0.5) * 2.4 : 0), 0.4 + rand() * 3.2, y * CELL + CELL / 2 + fz * CELL * 0.401 + (fx ? (rand() - 0.5) * 2.4 : 0));
    led.rotation.y = fx === 1 ? Math.PI / 2 : fx === -1 ? -Math.PI / 2 : fz === -1 ? Math.PI : 0;
    led.userData.phase = rand() * 10; led.userData.speed = 1 + rand() * 6;
    leds.push(led); group.add(led);
  }

  // ---------- lights: one per room, a few shadow casters ----------
  const lights = [];
  const maxShadow = quality === 'high' ? 2 : quality === 'medium' ? 1 : 0;
  rooms.forEach((r, i) => {
    const col = i % 3 === 0 ? accent.light : palette.light;
    const light = new THREE.PointLight(col, 95, CELL * 10, 1.5);
    light.position.set(r.cx * CELL + CELL / 2, WALL_H - 0.6, r.cy * CELL + CELL / 2);
    if (i < maxShadow) { light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.004; light.shadow.radius = 3; }
    light.userData.base = horror ? 70 : 95; light.userData.flicker = horror ? 'torch' : rand() < 0.25;
    if (horror) { light.intensity = 110; light.userData.base = 110; light.position.y = WALL_H - 1.4; }
    group.add(light); lights.push(light);
    // visible lamp fixture
    if (horror) {
      const ch = new THREE.Group(); ch.position.set(light.position.x, WALL_H - 1.5, light.position.z);
      const iron = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.9, roughness: 0.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 6, 24), iron); ring.rotation.x = Math.PI / 2; ch.add(ring);
      for (let k = 0; k < 4; k++) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4), iron); const a = k / 4 * 6.28; rod.position.set(Math.cos(a) * 0.35, 0.75, Math.sin(a) * 0.35); rod.rotation.z = Math.cos(a) * 0.45; rod.rotation.x = -Math.sin(a) * 0.45; ch.add(rod); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, f = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.scale.set(0.14, 0.28, 1); f.position.set(Math.cos(a) * 0.7, 0.16, Math.sin(a) * 0.7); ch.add(f); }
      group.add(ch);
    } else {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: col, emissiveIntensity: 2.5 }));
      lamp.position.set(light.position.x, WALL_H - 0.08, light.position.z);
      group.add(lamp);
    }
  });
  const hemi = horror ? new THREE.HemisphereLight(0x8a6a58, 0x120806, 0.75) : new THREE.HemisphereLight(0x7d8fbd, 0x1a1a22, 1.1);
  group.add(hemi);

  // ---------- start, exit, distances ----------
  const start = rooms[0];
  const dist = bfs(grid, start.cx, start.cy);
  let exitRoom = rooms[1];
  for (const r of rooms) if (dist[r.cy * W + r.cx] > dist[exitRoom.cy * W + exitRoom.cx]) exitRoom = r;
  const exit = buildPortal(exitRoom.cx * CELL + CELL / 2, exitRoom.cy * CELL + CELL / 2, tex.glow);
  group.add(exit.group);

  // floating dust motes for atmosphere
  const dustCount = quality === 'low' ? 400 : 1400;
  const dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) { dustPos[i * 3] = rand() * W * CELL; dustPos[i * 3 + 1] = rand() * WALL_H; dustPos[i * 3 + 2] = rand() * H * CELL; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.06, map: tex.glow, color: horror ? 0xffb080 : 0x9fdcff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(dust);

  scene.add(group);
  scene.fog = horror ? new THREE.FogExp2(0x0c0604, 0.018) : new THREE.FogExp2(0x060a12, 0.016);
  const deco = decorate({ grid, W, H, rooms }, theme, rand, CELL, WALL_H, gore);
  group.add(deco.group);

  const api = {
    group, grid, rooms, W, H, start, exitRoom, exit, lights, leds, dust, palette, theme,
    isSolid(wx, wz) { return solid(Math.floor(wx / CELL), Math.floor(wz / CELL)); },
    cellOf(wx, wz) { return [Math.floor(wx / CELL), Math.floor(wz / CELL)]; },
    centreOf(cx, cy) { return new THREE.Vector3(cx * CELL + CELL / 2, 0, cy * CELL + CELL / 2); },
    /** Grid line-of-sight (DDA). */
    los(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), steps = Math.ceil(len / (CELL * 0.25));
      for (let i = 1; i < steps; i++) if (solid(Math.floor((ax + dx * i / steps) / CELL), Math.floor((az + dz * i / steps) / CELL))) return false;
      return true;
    },
    /** Distance along the ray (x,z plane) to the first wall, up to max. */
    rayWall(ox, oz, dx, dz, max) {
      const step = 0.1;
      for (let t = 0; t < max; t += step) if (solid(Math.floor((ox + dx * t) / CELL), Math.floor((oz + dz * t) / CELL))) return t;
      return max;
    },
    flow: null,
    updateFlow(px, pz) { const [cx, cy] = api.cellOf(px, pz); if (!solid(cx, cy)) api.flow = bfs(grid, cx, cy); },
    /** Next waypoint (world) toward the player from a world position. */
    nextStep(wx, wz) {
      const [cx, cy] = api.cellOf(wx, wz);
      if (!api.flow) return null;
      let best = null, bd = api.flow[cy * W + cx];
      if (bd < 0) bd = 1e9;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, ny = cy + dy, d = api.flow[ny * W + nx];
        if (d < 0 || solid(nx, ny)) continue;
        if (dx && dy && (solid(cx + dx, cy) || solid(cx, cy + dy))) continue; // no corner cutting
        if (d < bd) { bd = d; best = [nx, ny]; }
      }
      return best ? api.centreOf(best[0], best[1]) : null;
    },
    randomFloorInRoom(r, avoid = []) {
      for (let t = 0; t < 40; t++) {
        const x = r.x + Math.floor(rand() * r.w), y = r.y + Math.floor(rand() * r.h);
        if (grid[y * W + x] !== 0) continue;
        const c = api.centreOf(x, y); c.x += (rand() - 0.5) * 2; c.z += (rand() - 0.5) * 2;
        if (avoid.some(a => a.distanceTo(c) < 2.5)) continue;
        return c;
      }
      return api.centreOf(r.cx, r.cy);
    },
    distFromStart(r) { return dist[r.cy * W + r.cx]; },
    rand,
    update(t) {
      for (const l of lights) {
        if (l.userData.flicker === 'torch') l.intensity = l.userData.base * (0.78 + Math.sin(t * 9 + l.position.x) * 0.1 + Math.sin(t * 23 + l.position.z) * 0.08 + Math.random() * 0.06);
        else if (l.userData.flicker) l.intensity = l.userData.base * (Math.sin(t * 23) > 0.93 || Math.random() < 0.02 ? 0.15 : 1);
      }
      deco.update(t);
      for (const led of leds) led.visible = Math.sin(t * led.userData.speed + led.userData.phase) > -0.3;
      dust.rotation.y = Math.sin(t * 0.05) * 0.002;
      exit.update(t);
    },
    dispose() {
      scene.remove(group);
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) o.material.dispose?.(); });
    },
  };
  return api;
}

function buildPortal(x, z, glow) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.9, roughness: 0.25, emissive: 0x38f2ff, emissiveIntensity: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 16, 64), ringMat);
  ring.position.y = 2.1; group.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
  ring2.position.y = 2.1; group.add(ring2);
  const core = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshBasicMaterial({ color: 0x38f2ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.y = 2.1; group.add(core);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0x151a24, metalness: 0.8, roughness: 0.3, emissive: 0x38f2ff, emissiveIntensity: 0.25 }));
  base.position.y = 0.15; group.add(base);
  const light = new THREE.PointLight(0x38f2ff, 40, 14, 1.5); light.position.y = 2.2; group.add(light);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x38f2ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(6, 6, 1); halo.position.y = 2.1; group.add(halo);
  let active = false;
  return {
    group, get active() { return active; },
    setActive(v) {
      active = v;
      ringMat.emissive.set(v ? 0x5dff8f : 0x38f2ff); ringMat.emissiveIntensity = v ? 2.2 : 0.6;
      core.material.color.set(v ? 0x5dff8f : 0x38f2ff); core.material.opacity = v ? 0.7 : 0.25;
      light.color.set(v ? 0x5dff8f : 0x38f2ff); light.intensity = v ? 90 : 30; halo.material.color.set(v ? 0x5dff8f : 0x38f2ff);
    },
    update(t) {
      ring.rotation.z = t * 0.6; ring2.rotation.z = -t * 1.3; ring.rotation.y = Math.sin(t * 0.7) * 0.15;
      core.rotation.z = t * 2; core.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
      halo.material.opacity = 0.35 + Math.sin(t * 3) * 0.15 + (active ? 0.3 : 0);
    },
  };
}
