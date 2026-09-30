// Energy orbs for the Arc Launcher and enemy fire.
import * as THREE from 'three';
import { WALL_H } from './level.js';

export class Projectiles {
  constructor(scene, glowTex) {
    this.scene = scene; this.glow = glowTex; this.list = [];
    this.geo = new THREE.SphereGeometry(1, 12, 8);
  }
  fire(from, dir, opts) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.scale.setScalar(opts.size * 0.45); group.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: opts.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(opts.size * 5); group.add(halo);
    if (opts.bfg) { const ring = new THREE.Mesh(new THREE.TorusGeometry(opts.size * 1.4, opts.size * 0.12, 8, 32), new THREE.MeshBasicMaterial({ color: opts.color })); group.add(ring); const ring2 = ring.clone(); ring2.rotation.x = Math.PI / 2; group.add(ring2); }
    group.position.copy(from);
    this.scene.add(group);
    this.list.push({ group, vel: dir.clone().multiplyScalar(opts.speed), life: 4, ...opts });
  }
  update(dt, game) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      const prev = p.group.position.clone();
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.group.position.addScaledVector(p.vel, dt);
      if (p.bfg) p.group.rotation.y += dt * 4;
      const pos = p.group.position;
      if (Math.random() < 0.8) game.fx.spawn(pos, p.vel.clone().multiplyScalar(-0.05), p.color, p.size * 1.3, 0.25);
      let hit = p.life <= 0 || pos.y < 0.05 || pos.y > WALL_H - 0.05 || game.level.isSolid(pos.x, pos.z);
      let target = null;
      if (!hit && p.owner === 'player') {
        for (const e of game.enemies) if (!e.dead && e.centre.distanceTo(pos) < e.t.radius + 0.5) { hit = true; target = e; break; }
      } else if (!hit && p.owner === 'enemy') {
        if (game.player.eye.clone().setY(game.player.eye.y - 0.6).distanceTo(pos) < 0.9) { hit = true; target = 'player'; }
      }
      if (!hit) continue;
      const at = hit && game.level.isSolid(pos.x, pos.z) ? prev : pos.clone();
      if (p.owner === 'player' && p.bfg) {
        game.bfgBlast(at);
      } else if (p.owner === 'player') {
        game.explodeAt(at, p.dmg, p.splash || 3, p.color);
      } else {
        if (target === 'player') game.hurtPlayer(p.dmg, at);
        game.fx.sparks(at, new THREE.Vector3(0, 1, 0), p.color, 12, 5);
        if (p.acid) { game.fx.burst(at, 0x9dff4a, 18, 4, 0.25); game.audio.squelch?.(); }
        game.fx.light(at, p.color, 20, 0.15, 6);
      }
      this.scene.remove(p.group);
      p.group.traverse(o => o.material?.dispose?.());
      this.list.splice(i, 1);
    }
  }
  clear() { for (const p of this.list) this.scene.remove(p.group); this.list = []; }
}
