// Pooled particles, tracers, flashes, shockwaves and scorch decals.
import * as THREE from 'three';
import { glowSprite, scorchSprite, bloodSplatSprite } from './textures.js';

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    this.glow = glowSprite();
    this.scorch = scorchSprite();
    this.max = quality === 'low' ? 250 : 700;
    this.parts = [];
    this.free = [];
    for (let i = 0; i < this.max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.visible = false; scene.add(s); this.free.push(s);
    }
    // blood: normal-blended droplets (additive would glow), splat decals and gibs
    this.bloodTex = [bloodSplatSprite(3), bloodSplatSprite(17), bloodSplatSprite(29)];
    this.drops = []; this.freeDrops = [];
    for (let i = 0; i < (quality === 'low' ? 150 : 400); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: 0x7a0606, transparent: true, depthWrite: false }));
      s.visible = false; scene.add(s); this.freeDrops.push(s);
    }
    this.gibs = [];
    this.gibGeo = [new THREE.IcosahedronGeometry(0.09, 0), new THREE.BoxGeometry(0.14, 0.07, 0.1), new THREE.TetrahedronGeometry(0.1, 0)];
    this.gibMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, roughness: 0.35, metalness: 0.05 });
    this.gibMat2 = new THREE.MeshStandardMaterial({ color: 0xa8958a, roughness: 0.8 });
    this.gore = true;
    this.tracers = [];
    this.flashes = [];
    this.rings = [];
    this.decals = [];
    // a small pool of dynamic lights (point lights are expensive, so reuse a few)
    this.lightPool = Array.from({ length: 4 }, () => { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); return { l, life: 0, max: 1, peak: 0 }; });
  }

  spawn(pos, vel, color, size, life, gravity = 0, drag = 0) {
    const s = this.free.pop() || this.parts.shift()?.s;
    if (!s) return;
    s.visible = true; s.position.copy(pos); s.material.color.set(color); s.material.opacity = 1; s.scale.setScalar(size);
    this.parts.push({ s, vel: vel.clone(), life, max: life, size, gravity, drag });
  }

  sparks(pos, normal, color, n = 10, speed = 6) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).add(normal.clone().multiplyScalar(1.5)).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      this.spawn(pos, v, color, 0.08 + Math.random() * 0.1, 0.25 + Math.random() * 0.35, 12, 1.5);
    }
    this.spawn(pos, new THREE.Vector3(), color, 0.9, 0.08);
  }

  burst(pos, color, n = 40, speed = 9, size = 0.25) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.3 + Math.random()));
      this.spawn(pos, v, i % 3 ? color : 0xffffff, size * (0.5 + Math.random()), 0.4 + Math.random() * 0.6, 6, 2.2);
    }
  }

  smoke(pos, n = 10) {
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.5);
      this.spawn(pos.clone().add(new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5))), v, 0x3a3f4a, 0.8 + Math.random() * 0.8, 1.2 + Math.random(), -0.4, 0.8);
    }
  }

  light(pos, color, peak, life, range = 10) {
    const slot = this.lightPool.reduce((a, b) => (a.life < b.life ? a : b));
    slot.l.position.copy(pos); slot.l.color.set(color); slot.l.distance = range; slot.life = life; slot.max = life; slot.peak = peak; slot.l.intensity = peak;
  }

  tracer(from, to, color, width = 0.035, life = 0.09) {
    const dir = to.clone().sub(from), len = dir.length();
    const geo = new THREE.CylinderGeometry(width, width, len, 5, 1, true);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from).add(to).multiplyScalar(0.5); m.lookAt(to);
    this.scene.add(m); this.tracers.push({ m, life, max: life });
  }

  shockwave(pos, color, radius = 5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.55, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(pos); m.position.y = Math.max(0.05, pos.y - 0.5); m.rotation.x = -Math.PI / 2;
    this.scene.add(m); this.rings.push({ m, life: 0.45, max: 0.45, radius });
  }

  decal(pos, normal, size = 0.6, color = 0x000000) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: this.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: color || 0xffffff, opacity: 0.85 }));
    m.position.copy(pos).add(normal.clone().multiplyScalar(0.02));
    m.lookAt(pos.clone().add(normal)); m.rotateZ(Math.random() * 6);
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > 90) { const old = this.decals.shift(); this.scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
  }

  explosion(pos, color = 0xff7a2e, radius = 5) {
    this.burst(pos, color, 70, 12, 0.45);
    this.burst(pos, 0xffe2a8, 25, 5, 0.9);
    this.smoke(pos, 14);
    this.light(pos, color, 220, 0.5, radius * 3);
    this.shockwave(pos, color, radius);
  }

  bloodSpray(pos, dir, n = 14, speed = 5) {
    if (!this.gore) return;
    for (let i = 0; i < n; i++) {
      const s = this.freeDrops.pop() || this.drops.shift()?.s;
      if (!s) return;
      const v = dir.clone().multiplyScalar(speed * (0.3 + Math.random())).add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3));
      s.visible = true; s.position.copy(pos); s.material.opacity = 1; const size = 0.05 + Math.random() * 0.12; s.scale.setScalar(size);
      s.material.color.setHex(Math.random() < 0.5 ? 0x5a0404 : 0x360202);
      this.drops.push({ s, vel: v, life: 0.6 + Math.random() * 0.6, max: 1.2, size });
    }
  }

  /** Blood splat decal on a surface (floor or wall). */
  bloodSplat(pos, normal, size = 1) {
    if (!this.gore) return;
    const mat = new THREE.MeshStandardMaterial({ map: this.bloodTex[Math.floor(Math.random() * 3)], color: Math.random() < 0.5 ? 0x3a0202 : 0x2a0101, transparent: true, depthWrite: false, roughness: 0.5, envMapIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -4 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.position.copy(pos).add(normal.clone().multiplyScalar(0.015));
    m.lookAt(pos.clone().add(normal)); m.rotateZ(Math.random() * 6);
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > 140) { const old = this.decals.shift(); this.scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
  }

  gibBurst(pos, n = 8, speed = 6) {
    if (!this.gore) return;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Mesh(this.gibGeo[i % 3], i % 4 === 3 ? this.gibMat2 : this.gibMat);
      g.position.copy(pos); g.castShadow = true;
      g.scale.setScalar(0.6 + Math.random() * 1.2);
      this.scene.add(g);
      this.gibs.push({ g, vel: new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random())).add(new THREE.Vector3(0, 3, 0)), spin: new THREE.Vector3().randomDirection().multiplyScalar(10), life: 12, bled: false });
    }
    if (this.gibs.length > 80) { for (const old of this.gibs.splice(0, this.gibs.length - 80)) this.scene.remove(old.g); }
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.life -= dt;
      d.vel.y -= 14 * dt; d.s.position.addScaledVector(d.vel, dt);
      if (d.s.position.y < 0.02) { d.s.position.y = 0.02; d.vel.set(0, 0, 0); }
      d.s.material.opacity = Math.min(1, d.life * 2);
      if (d.life <= 0) { d.s.visible = false; this.freeDrops.push(d.s); this.drops.splice(i, 1); }
    }
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const b = this.gibs[i]; b.life -= dt;
      if (b.g.position.y > 0.05 || b.vel.lengthSq() > 0.01) {
        b.vel.y -= 16 * dt; b.g.position.addScaledVector(b.vel, dt);
        b.g.rotation.x += b.spin.x * dt; b.g.rotation.z += b.spin.z * dt;
        if (b.g.position.y < 0.05) {
          b.g.position.y = 0.05; b.vel.multiplyScalar(0.35); b.vel.y = Math.abs(b.vel.y) > 1.5 ? -b.vel.y * 0.3 : 0; b.spin.multiplyScalar(0.4);
          if (!b.bled) { b.bled = true; this.bloodSplat(new THREE.Vector3(b.g.position.x, 0.01, b.g.position.z), new THREE.Vector3(0, 1, 0), 0.35 + Math.random() * 0.4); }
        }
      }
      if (b.life <= 0) { b.g.scale.multiplyScalar(0.9); if (b.g.scale.x < 0.05) { this.scene.remove(b.g); this.gibs.splice(i, 1); } }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.free.push(p.s); this.parts.splice(i, 1); continue; }
      p.vel.y -= p.gravity * dt; p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.s.position.addScaledVector(p.vel, dt);
      if (p.s.position.y < 0.02) { p.s.position.y = 0.02; p.vel.y *= -0.3; }
      const k = p.life / p.max;
      p.s.material.opacity = k; p.s.scale.setScalar(p.size * (p.gravity < 0 ? 2 - k : 0.5 + k * 0.5));
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.life -= dt; t.m.material.opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) { this.scene.remove(t.m); t.m.geometry.dispose(); t.m.material.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.life -= dt; const k = 1 - r.life / r.max;
      r.m.scale.setScalar(1 + k * r.radius * 2); r.m.material.opacity = 1 - k;
      if (r.life <= 0) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (const s of this.lightPool) { if (s.life > 0) { s.life -= dt; s.l.intensity = Math.max(0, s.peak * (s.life / s.max)); } else s.l.intensity = 0; }
  }

  clear() {
    for (const p of this.parts) { p.s.visible = false; this.free.push(p.s); }
    this.parts = [];
    for (const t of this.tracers) this.scene.remove(t.m); this.tracers = [];
    for (const r of this.rings) this.scene.remove(r.m); this.rings = [];
    for (const d of this.decals) this.scene.remove(d); this.decals = [];
    for (const d of this.drops) { d.s.visible = false; this.freeDrops.push(d.s); } this.drops = [];
    for (const b of this.gibs) this.scene.remove(b.g); this.gibs = [];
  }
}
