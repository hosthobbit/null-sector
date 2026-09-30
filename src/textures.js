// Procedural PBR-ish textures drawn on canvases: colour + normal + roughness from one height map.
import * as THREE from 'three';

const SIZE = 512;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return [c, c.getContext('2d')];
}

// Soft value noise, tileable.
function noiseField(rand, cells) {
  const g = Array.from({ length: cells * cells }, rand);
  const at = (x, y) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  return (u, v) => {
    const x = u * cells, y = v * cells, xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function fbm(rand) {
  const layers = [noiseField(rand, 4), noiseField(rand, 8), noiseField(rand, 16), noiseField(rand, 32), noiseField(rand, 64)];
  return (u, v) => layers.reduce((s, f, i) => s + f(u, v) / (2 ** i), 0) / 1.94;
}

/** Turn a greyscale height canvas into a tangent-space normal map. */
function heightToNormal(hctx, strength) {
  const src = hctx.getImageData(0, 0, SIZE, SIZE).data;
  const [c, ctx] = canvas();
  const out = ctx.createImageData(SIZE, SIZE);
  const h = (x, y) => src[(((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)) * 4] / 255;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1), i = (y * SIZE + x) * 4;
    out.data[i] = (-dx / len * 0.5 + 0.5) * 255;
    out.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
    out.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function toTex(c, repeat, srgb) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Paint a texture set. draw(ctxColour, ctxHeight, ctxRough, rand, noise) */
function makeSet(seed, draw, normalStrength, repeat = 1) {
  const rand = rng(seed), noise = fbm(rand);
  const [cc, cctx] = canvas(), [hc, hctx] = canvas(), [rc, rctx] = canvas();
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, SIZE, SIZE);
  draw(cctx, hctx, rctx, rand, noise);
  // grime + wear pass shared by every surface
  const cimg = cctx.getImageData(0, 0, SIZE, SIZE), rimg = rctx.getImageData(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const n = noise(x / SIZE, y / SIZE), i = (y * SIZE + x) * 4, grime = 0.72 + n * 0.45;
    cimg.data[i] *= grime; cimg.data[i + 1] *= grime; cimg.data[i + 2] *= grime;
    rimg.data[i] = Math.min(255, rimg.data[i] + (n - 0.5) * 60);
    rimg.data[i + 1] = rimg.data[i + 2] = rimg.data[i];
  }
  cctx.putImageData(cimg, 0, 0); rctx.putImageData(rimg, 0, 0);
  return {
    map: toTex(cc, repeat, true),
    normalMap: toTex(heightToNormal(hctx, normalStrength), repeat, false),
    roughnessMap: toTex(rc, repeat, false),
  };
}

function rivet(ctx, hctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r / 3, y - r / 3, 0, x, y, r);
  g.addColorStop(0, '#8b93a3'); g.addColorStop(1, '#2a2f38');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  const hg = hctx.createRadialGradient(x, y, 0, x, y, r);
  hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#808080');
  hctx.fillStyle = hg; hctx.beginPath(); hctx.arc(x, y, r, 0, 7); hctx.fill();
}

export function wallTextures() {
  return makeSet(11, (ctx, hctx, rctx, rand) => {
    ctx.fillStyle = '#3a414d'; ctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#9a9a9a'; rctx.fillRect(0, 0, SIZE, SIZE);
    // two rows of panels
    const panels = [[8, 8, 240, 300], [264, 8, 240, 300], [8, 324, 496, 180]];
    for (const [x, y, w, h] of panels) {
      const shade = 50 + Math.floor(rand() * 18);
      ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 16})`; ctx.fillRect(x, y, w, h);
      hctx.fillStyle = '#a0a0a0'; hctx.fillRect(x, y, w, h);
      hctx.strokeStyle = '#3c3c3c'; hctx.lineWidth = 6; hctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = '#1a1e25'; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
      rctx.fillStyle = `rgb(${120 + rand() * 60 | 0},0,0)`; rctx.fillRect(x, y, w, h);
      for (const [rx, ry] of [[x + 14, y + 14], [x + w - 14, y + 14], [x + 14, y + h - 14], [x + w - 14, y + h - 14]]) rivet(ctx, hctx, rx, ry, 6);
    }
    // vent slats
    for (let i = 0; i < 9; i++) {
      const y = 350 + i * 15;
      ctx.fillStyle = '#15181e'; ctx.fillRect(40, y, 200, 7);
      hctx.fillStyle = '#404040'; hctx.fillRect(40, y, 200, 7);
    }
    // hazard stripe along the bottom
    for (let i = -2; i < 20; i++) {
      ctx.fillStyle = i % 2 ? '#c9a227' : '#1b1b1b';
      ctx.beginPath(); ctx.moveTo(i * 32, 512); ctx.lineTo(i * 32 + 32, 512); ctx.lineTo(i * 32 + 52, 490); ctx.lineTo(i * 32 + 20, 490); ctx.fill();
    }
    // scratches
    ctx.strokeStyle = 'rgba(200,210,225,.18)'; ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) { const x = rand() * SIZE, y = rand() * SIZE; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - .5) * 40, y + (rand() - .5) * 12); ctx.stroke(); }
  }, 3.2);
}

export function floorTextures() {
  return makeSet(23, (ctx, hctx, rctx, rand) => {
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#6a6a6a'; rctx.fillRect(0, 0, SIZE, SIZE);
    // 4x4 diamond plate tiles
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * 256, y0 = ty * 256;
      ctx.fillStyle = '#343942'; ctx.fillRect(x0 + 4, y0 + 4, 248, 248);
      hctx.strokeStyle = '#303030'; hctx.lineWidth = 8; hctx.strokeRect(x0 + 4, y0 + 4, 248, 248);
      for (let y = 0; y < 256; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < 256; x += 22) {
        const cx = x0 + x + 6, cy = y0 + y + 6;
        hctx.save(); hctx.translate(cx, cy); hctx.rotate(Math.PI / 4);
        hctx.fillStyle = '#c8c8c8'; hctx.fillRect(-7, -2, 14, 4); hctx.restore();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#4a515c'; ctx.fillRect(-7, -2, 14, 4); ctx.restore();
      }
    }
    // oil stains
    for (let i = 0; i < 7; i++) {
      const x = rand() * SIZE, y = rand() * SIZE, r = 20 + rand() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(5,7,10,.55)'); g.addColorStop(1, 'rgba(5,7,10,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      const rg = rctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(20,20,20,.8)'); rg.addColorStop(1, 'rgba(20,20,20,0)');
      rctx.fillStyle = rg; rctx.beginPath(); rctx.arc(x, y, r, 0, 7); rctx.fill();
    }
  }, 4.0);
}

export function ceilingTextures() {
  return makeSet(37, (ctx, hctx, rctx) => {
    ctx.fillStyle = '#1d2129'; ctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#b0b0b0'; rctx.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#262b35'; ctx.fillRect(i * 128 + 10, 0, 108, SIZE);
      hctx.fillStyle = '#b8b8b8'; hctx.fillRect(i * 128 + 10, 0, 108, SIZE);
      ctx.fillStyle = '#121419'; ctx.fillRect(i * 128 + 60, 0, 8, SIZE);
      hctx.fillStyle = '#383838'; hctx.fillRect(i * 128 + 60, 0, 8, SIZE);
    }
  }, 2.5);
}

/** Soft round sprite for particles and glows. */
export function glowSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Dark scorch decal. */
export function scorchSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.5, 'rgba(10,6,4,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ======================= Undercroft (horror) textures =======================

/** Old stone brick wall with mortar, damp and blood streaks. */
export function stoneWallTextures() {
  return makeSet(51, (ctx, hctx, rctx, rand) => {
    ctx.fillStyle = '#2e2a27'; ctx.fillRect(0, 0, SIZE, SIZE);
    hctx.fillStyle = '#303030'; hctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#e0e0e0'; rctx.fillRect(0, 0, SIZE, SIZE);
    const rows = 8, bh = SIZE / rows;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? 0 : 64;
      for (let x = -off; x < SIZE; x += 128) {
        const w = 128 - 6, h = bh - 6, bx = x + 3, by = r * bh + 3;
        const shade = 60 + rand() * 30 | 0, warm = rand() * 10 | 0;
        ctx.fillStyle = `rgb(${shade + warm},${shade},${shade - 6})`;
        ctx.fillRect(bx, by, w, h);
        const hg = hctx.createLinearGradient(bx, by, bx, by + h);
        hg.addColorStop(0, '#b0b0b0'); hg.addColorStop(0.5, '#d8d8d8'); hg.addColorStop(1, '#a0a0a0');
        hctx.fillStyle = hg; hctx.fillRect(bx + 2, by + 2, w - 4, h - 4);
        for (let k = 0; k < 6; k++) { // chips and cracks
          hctx.fillStyle = '#707070'; hctx.beginPath(); hctx.arc(bx + rand() * w, by + rand() * h, 1 + rand() * 4, 0, 7); hctx.fill();
        }
      }
    }
    // damp patches and blood drips
    for (let i = 0; i < 5; i++) {
      const x = rand() * SIZE, len = 60 + rand() * 260, w = 3 + rand() * 7;
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(90,6,6,.9)'); g.addColorStop(1, 'rgba(60,4,4,0)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, w, len);
      ctx.beginPath(); ctx.arc(x + w / 2, len * 0.95, w * 0.7, 0, 7); ctx.fillStyle = 'rgba(80,5,5,.6)'; ctx.fill();
      rctx.fillStyle = 'rgba(40,40,40,.9)'; rctx.fillRect(x, 0, w, len);
    }
  }, 5.0);
}

/** Uneven flagstones. */
export function flagstoneTextures() {
  return makeSet(63, (ctx, hctx, rctx, rand) => {
    ctx.fillStyle = '#1d1b19'; ctx.fillRect(0, 0, SIZE, SIZE);
    hctx.fillStyle = '#202020'; hctx.fillRect(0, 0, SIZE, SIZE);
    rctx.fillStyle = '#d8d8d8'; rctx.fillRect(0, 0, SIZE, SIZE);
    const cells = 4, cs = SIZE / cells;
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      const jx = (rand() - 0.5) * 10, jy = (rand() - 0.5) * 10;
      const shade = 48 + rand() * 26 | 0;
      ctx.fillStyle = `rgb(${shade + 4},${shade},${shade - 4})`;
      const px = x * cs + 5 + jx, py = y * cs + 5 + jy, w = cs - 10, h = cs - 10;
      ctx.beginPath(); ctx.roundRect(px, py, w, h, 10); ctx.fill();
      hctx.fillStyle = `rgb(${170 + rand() * 50 | 0},${170},${170})`; hctx.beginPath(); hctx.roundRect(px + 3, py + 3, w - 6, h - 6, 10); hctx.fill();
    }
    for (let i = 0; i < 4; i++) { // old dried blood
      const x = rand() * SIZE, y = rand() * SIZE, r = 25 + rand() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(60,3,3,.8)'); g.addColorStop(1, 'rgba(40,3,3,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
  }, 4.0);
}

/** Pale, veined, bruised skin for the monsters. */
export function skinTextures(tint = [150, 128, 112]) {
  return makeSet(77 + tint[0], (ctx, hctx, rctx, rand, noise) => {
    const img = ctx.createImageData(SIZE, SIZE), himg = hctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const n = noise(x / SIZE * 2, y / SIZE * 2), i = (y * SIZE + x) * 4;
      const bruise = Math.max(0, noise(x / SIZE + 0.3, y / SIZE + 0.7) - 0.55) * 3;
      img.data[i] = tint[0] * (0.75 + n * 0.4) - bruise * 40;
      img.data[i + 1] = tint[1] * (0.75 + n * 0.4) - bruise * 55;
      img.data[i + 2] = tint[2] * (0.75 + n * 0.4) - bruise * 20;
      img.data[i + 3] = 255;
      const h = 110 + n * 90; himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = h; himg.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); hctx.putImageData(himg, 0, 0);
    rctx.fillStyle = '#8a8a8a'; rctx.fillRect(0, 0, SIZE, SIZE);
    // veins
    for (let v = 0; v < 26; v++) {
      let x = rand() * SIZE, y = rand() * SIZE, a = rand() * 6.28;
      ctx.strokeStyle = `rgba(70,20,40,${0.25 + rand() * 0.3})`; hctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = hctx.lineWidth = 1 + rand() * 2.5;
      ctx.beginPath(); hctx.beginPath(); ctx.moveTo(x, y); hctx.moveTo(x, y);
      for (let s = 0; s < 14; s++) { a += (rand() - 0.5) * 0.9; x += Math.cos(a) * 12; y += Math.sin(a) * 12; ctx.lineTo(x, y); hctx.lineTo(x, y); }
      ctx.stroke(); hctx.stroke();
    }
    // wounds
    for (let w = 0; w < 5; w++) {
      const x = rand() * SIZE, y = rand() * SIZE, r = 6 + rand() * 16;
      ctx.fillStyle = 'rgba(95,8,10,.85)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, rand() * 3, 0, 7); ctx.fill();
      hctx.fillStyle = '#404040'; hctx.beginPath(); hctx.ellipse(x, y, r, r * 0.45, 0, 0, 7); hctx.fill();
      rctx.fillStyle = '#202020'; rctx.beginPath(); rctx.arc(x, y, r, 0, 7); rctx.fill();
    }
  }, 3.0);
}

/** Irregular blood splat (for decals) - white alpha shape, tinted by material colour. */
export function bloodSplatSprite(seed = 5) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), rand = rng(seed);
  ctx.fillStyle = '#fff';
  const blob = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  blob(64, 64, 26 + rand() * 10);
  for (let i = 0; i < 18; i++) { const a = rand() * 6.28, d = 20 + rand() * 38; blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + rand() * 9); }
  for (let i = 0; i < 6; i++) { // streaks
    const a = rand() * 6.28; ctx.save(); ctx.translate(64, 64); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(34, 0, 22, 3 + rand() * 3, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Candle / torch flame. */
export function flameSprite() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(16, 44, 1, 16, 38, 26);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,80,.9)'); g.addColorStop(0.7, 'rgba(255,90,20,.4)'); g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(16, 38, 11, 26, 0, 0, 7); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Scrawled wall writing, e.g. "IT SEES YOU". */
export function writingSprite(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 76px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(256, 64); ctx.rotate(-0.04); ctx.fillText(text, 0, 0); ctx.restore();
  // drips
  const rand = rng(text.length * 13);
  for (let i = 0; i < 14; i++) { const x = 40 + rand() * 430; ctx.fillRect(x, 70 + rand() * 20, 2 + rand() * 3, 10 + rand() * 40); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
