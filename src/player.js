// First-person controller: mouse look, acceleration-based movement, sprint, jump, phase dash.
import * as THREE from 'three';
import { moveCircle } from './physics.js';

export class Player {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.45; this.height = 1.7; this.y = 0; this.vy = 0; this.grounded = true;
    this.keys = {}; this.sens = 0.5; this.invert = false;
    this.hp = 100; this.shield = 0; this.maxHp = 100;
    this.dashCd = 0; this.dashT = 0; this.invuln = 0;
    this.bobT = 0; this.stepT = 0; this.lookDelta = new THREE.Vector2(); this.fovKick = 0;
    this.knock = new THREE.Vector3();
  }
  get eye() { return new THREE.Vector3(this.pos.x, this.y + this.height, this.pos.z); }
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get sprinting() { return this.keys.ShiftLeft && (this.keys.KeyW) && this.grounded; }

  reset(pos, yaw = 0) {
    this.pos.copy(pos); this.pos.y = 0; this.vel.set(0, 0, 0); this.y = 0; this.vy = 0;
    this.yaw = yaw; this.pitch = 0; this.dashCd = 0; this.knock.set(0, 0, 0);
  }

  look(dx, dy) {
    const k = 0.0022 * this.sens;
    this.yaw -= dx * k; this.pitch -= dy * k * (this.invert ? -1 : 1);
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    this.lookDelta.set(dx, dy);
  }

  tryDash(audio) {
    if (this.dashCd > 0) return false;
    const f = this.forward, r = new THREE.Vector3(-f.z, 0, f.x);
    const dir = new THREE.Vector3();
    if (this.keys.KeyW) dir.add(f); if (this.keys.KeyS) dir.sub(f); if (this.keys.KeyD) dir.add(r); if (this.keys.KeyA) dir.sub(r);
    if (dir.lengthSq() === 0) dir.copy(f);
    this.vel.copy(dir.normalize().multiplyScalar(26));
    this.dashT = 0.18; this.dashCd = 2.2; this.invuln = 0.3; this.fovKick = 14;
    audio.dash();
    return true;
  }

  update(dt, level, audio) {
    const f = this.forward, r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (this.keys.KeyW) wish.add(f); if (this.keys.KeyS) wish.sub(f);
    if (this.keys.KeyD) wish.add(r); if (this.keys.KeyA) wish.sub(r);
    if (wish.lengthSq() > 0) wish.normalize();
    const max = this.sprinting ? 10.5 : 6.6;
    const accel = this.grounded ? 70 : 18;
    this.dashCd = Math.max(0, this.dashCd - dt); this.invuln = Math.max(0, this.invuln - dt);
    if (this.dashT > 0) this.dashT -= dt;
    else {
      const target = wish.multiplyScalar(max);
      const diff = target.sub(new THREE.Vector3(this.vel.x, 0, this.vel.z));
      const add = Math.min(diff.length(), accel * dt);
      if (diff.lengthSq() > 0) this.vel.addScaledVector(diff.normalize(), add);
      if (wish.lengthSq() === 0 && this.grounded) this.vel.multiplyScalar(Math.max(0, 1 - dt * 12));
    }
    this.knock.multiplyScalar(Math.max(0, 1 - dt * 6));
    const hit = moveCircle(this.pos, (this.vel.x + this.knock.x) * dt, (this.vel.z + this.knock.z) * dt, this.radius, level);
    if (hit && this.dashT > 0) this.dashT = 0;
    // vertical
    if (this.keys.Space && this.grounded) { this.vy = 6.2; this.grounded = false; }
    this.vy -= 18 * dt; this.y += this.vy * dt;
    if (this.y <= 0) { if (!this.grounded && this.vy < -6) audio.land(); this.y = 0; this.vy = 0; this.grounded = true; }
    // head bob + footsteps
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && speed > 1) {
      this.bobT += dt * speed * 1.35;
      this.stepT -= dt * speed;
      if (this.stepT <= 0) { audio.step(this.sprinting); this.stepT = 2.6; }
    }
    this.fovKick = Math.max(0, this.fovKick - dt * 40);
    const bob = this.grounded ? Math.sin(this.bobT) * 0.045 * Math.min(1, speed / 6) : 0;
    this.camera.position.set(this.pos.x, this.y + this.height + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobT * 0.5) * 0.004 * Math.min(1, speed / 6), 'YXZ');
    const v = this.lookDelta.clone(); this.lookDelta.multiplyScalar(0.5);
    return { speed, lookDelta: v };
  }
}
