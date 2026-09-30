// NULL SECTOR: main game loop, rendering pipeline, combat, HUD.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLevel, CELL, WALL_H, FINAL_DEPTH, dreadFor } from './level.js';
import { Player } from './player.js';
import { Viewmodel, WEAPONS } from './weapons.js';
import { Enemy, rollEnemy } from './enemies.js';
import { Effects } from './effects.js';
import { Projectiles } from './projectiles.js';
import { Pickups } from './pickups.js';
import { glowSprite } from './textures.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const DEFAULTS = { sens: 0.5, invert: false, fov: 78, vol: 0.7, bright: 1.3, quality: 'high', fps: false, gore: true };
function loadSettings() { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('ns-settings') || '{}') }; } catch { return { ...DEFAULTS }; } }
function saveSettings(s) { try { localStorage.setItem('ns-settings', JSON.stringify(s)); } catch {} }
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, damage: { value: 0 }, aberr: { value: 0.004 }, grain: { value: 0.016 }, heal: { value: 0 }, dread: { value: 0 }, lift: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, damage, aberr, grain, heal, dread, lift; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float d = length(c);
      float ab = aberr + damage * 0.02;
      vec3 col = vec3(texture2D(tDiffuse, uv + c*ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c*ab).b);
      col += (rnd(uv*vec2(1920.0,1080.0) + fract(time)) - 0.5) * grain;
      // deeper sectors: drained, blood-tinted colour, heavier grain and a vignette that pulses like a heartbeat
      col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(1.15, 0.78, 0.72), dread * 0.4);
      col += (rnd(uv*vec2(1300.0,900.0) + fract(time*1.3)) - 0.5) * grain * dread * 1.5;
      float beat = pow(max(0.0, sin(time * 5.2)), 12.0) * step(0.55, dread);
      col *= 1.0 - smoothstep(0.42 - dread * 0.12 - beat * 0.05, 0.98, d) * (0.8 + dread * 0.15);
      col = mix(col, col * vec3(1.6, 0.35, 0.4), damage * smoothstep(0.15, 0.85, d));
      col = mix(col, col * vec3(0.6, 1.4, 1.5), heal * smoothstep(0.3, 0.9, d));
      col *= 0.985 + 0.015 * sin(uv.y * 1100.0 + time * 8.0);
      col = pow(max(col, 0.0), vec3(1.0 / (1.0 + (lift - 1.0) * 0.28))); // brightness setting also lifts the shadows
      gl_FragColor = vec4(col, 1.0);
    }`,
};

class Game {
  constructor() {
    this.settings = loadSettings();
    this.quality = this.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.prepend(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 220);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    // viewmodel lives in its own scene so the gun never clips into walls
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.01, 10);
    this.vmScene.add(this.vmCamera);
    this.vmHemi = new THREE.HemisphereLight(0x9fb8ff, 0x0a0a10, 0.9); this.vmScene.add(this.vmHemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(1, 2, 1); this.vmScene.add(key);

    // image-based lighting so metal actually looks like metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env; this.scene.environmentIntensity = 0.28;
    this.vmScene.environment = env; this.vmScene.environmentIntensity = 0.45;
    this.glow = glowSprite();
    this.viewmodel = new Viewmodel(this.vmCamera, this.glow);
    this.player = new Player(this.camera);
    this.fx = new Effects(this.scene, this.quality);
    this.projectiles = new Projectiles(this.scene, this.glow);
    this.pickups = new Pickups(this.scene);
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.audio = audio.sfx;

    this.setupComposer();
    this.state = 'title';
    this.clock = new THREE.Clock();
    this.time = 0; this.shakeAmt = 0; this.damageFx = 0; this.healFx = 0;
    this.mouseDown = false; this.fireCd = 0; this.reloading = 0;
    this.flowT = 0; this.mapT = 0; this.feedEl = $('feed');
    this.perf = { acc: 0, n: 0, fps: 60 };
    this.bindInput();
    addEventListener('resize', () => this.resize());
    this.resize();
    const best = store.get('ns-best'); if (best) $('best').textContent = `BEST RUN  ${Number(best).toLocaleString()}`;
    // idle title-screen flythrough
    this.level = buildLevel(this.scene, 1, this.quality);
    this.player.reset(this.level.centreOf(this.level.start.cx, this.level.start.cy));
    this.applySettings();
    this.renderer.setAnimationLoop(() => this.frame());
    window.NS = this;
  }

  setupComposer() {
    const q = this.quality;
    this.pixelScale = q === 'high' ? Math.min(devicePixelRatio, 1.5) : q === 'medium' ? 0.85 : 0.7;
    this.renderer.setPixelRatio(this.pixelScale);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const vm = new RenderPass(this.vmScene, this.vmCamera); vm.clear = false; vm.clearDepth = true;
    this.composer.addPass(vm);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), q === 'low' ? 0.55 : 0.75, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.lift.value = this.settings.bright; this.final.uniforms.dread.value = this.level ? this.level.dread : 0;
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
  }

  resize() {
    this.camera.aspect = this.vmCamera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix(); this.vmCamera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    const canvas = this.renderer.domElement;
    $('play').onclick = () => this.startRun();
    $('again').onclick = () => this.startRun();
    $('resume').onclick = () => this.lock();
    $('quit').onclick = () => this.gameOver(true);
    this.bindSettings();
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas && this.state === 'playing') this.pause();
    });
    document.addEventListener('mousemove', e => { if (this.state === 'playing' && document.pointerLockElement === canvas) this.player.look(e.movementX, e.movementY); });
    document.addEventListener('mousedown', e => { if (this.state !== 'playing') return; if (e.button === 0) { this.mouseDown = true; this.tryFire(); } });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('wheel', e => { if (this.state === 'playing') this.cycleWeapon(Math.sign(e.deltaY)); });
    document.addEventListener('keydown', e => {
      this.player.keys[e.code] = true;
      if (this.state !== 'playing') return;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyQ' && this.player.tryDash(this.audio)) this.fx.burst(this.player.eye.clone().addScaledVector(this.player.forward, -1), 0x38f2ff, 20, 4, 0.2);
      if (e.code.startsWith('Digit')) { const i = Number(e.code.slice(5)) - 1; if (i >= 0 && i < WEAPONS.length) this.switchWeapon(i); }
      if (e.code === 'KeyM') this.toggleBigMap();
      if (e.code === 'KeyF') { this.settings.fps = !this.settings.fps; saveSettings(this.settings); this.applySettings(); }
      if (e.code === 'Space') e.preventDefault();
    });
    document.addEventListener('keyup', e => { this.player.keys[e.code] = false; });
    // go silent (and pause) whenever the game isn't on screen or the page is closing
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'playing') this.pause(); audio.suspend(); }
      else if (this.state !== 'playing') audio.resume();
    });
    addEventListener('pagehide', () => { audio.stopMusic(); audio.suspend(); });
  }

  // ---------------------------------------------------------------- settings
  bindSettings() {
    const S = this.settings, show = () => this.syncSettingsUI();
    const bindRange = (id, key, fmt) => { $(id).oninput = e => { S[key] = Number(e.target.value); $(id + 'v').textContent = fmt(S[key]); saveSettings(S); this.applySettings(); }; };
    bindRange('sens', 'sens', v => v.toFixed(2));
    bindRange('fov', 'fov', v => `${v}°`);
    bindRange('vol', 'vol', v => `${Math.round(v * 100)}%`);
    bindRange('bright', 'bright', v => `${Math.round(v * 100)}%`);
    $('invert').onchange = e => { S.invert = e.target.checked; saveSettings(S); this.applySettings(); };
    $('showfps').onchange = e => { S.fps = e.target.checked; saveSettings(S); this.applySettings(); };
    $('gore').onchange = e => { S.gore = e.target.checked; saveSettings(S); this.applySettings(); };
    $('quality').onchange = e => { S.quality = e.target.value; saveSettings(S); this.quality = S.quality; this.setupComposer(); this.resize(); };
    const open = from => { this.settingsFrom = from; show(); $(from).classList.add('hidden'); $('settingsmenu').classList.remove('hidden'); };
    $('titlesettings').onclick = () => open('title');
    $('pausesettings').onclick = () => open('pause');
    $('settingsback').onclick = () => this.closeSettings();
    $('settingsreset').onclick = () => { Object.assign(S, DEFAULTS); saveSettings(S); this.applySettings(); if (this.quality !== S.quality) { this.quality = S.quality; this.setupComposer(); this.resize(); } show(); };
    document.addEventListener('keydown', e => { if (e.code === 'Escape' && !$('settingsmenu').classList.contains('hidden')) this.closeSettings(); });
    show(); this.applySettings();
  }
  closeSettings() { $('settingsmenu').classList.add('hidden'); $(this.settingsFrom || 'title').classList.remove('hidden'); }
  syncSettingsUI() {
    const S = this.settings;
    $('sens').value = S.sens; $('sensv').textContent = S.sens.toFixed(2);
    $('fov').value = S.fov; $('fovv').textContent = `${S.fov}°`;
    $('bright').value = S.bright; $('brightv').textContent = `${Math.round(S.bright * 100)}%`;
    $('vol').value = S.vol; $('volv').textContent = `${Math.round(S.vol * 100)}%`;
    $('invert').checked = S.invert; $('showfps').checked = S.fps; $('quality').value = S.quality; $('gore').checked = S.gore;
  }
  applySettings() {
    const S = this.settings;
    this.player.sens = S.sens; this.player.invert = S.invert;
    audio.setVolume(S.vol);
    this.renderer.toneMappingExposure = 1.18 * S.bright;
    this.final.uniforms.lift.value = S.bright;
    $('fps').classList.toggle('hidden', !S.fps);
    this.fx.gore = S.gore;
  }

  lock() { try { this.renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch {} this.state = 'playing'; $('pause').classList.add('hidden'); audio.resume(); this.clock.getDelta(); }
  pause() { this.state = 'paused'; this.mouseDown = false; $('pause').classList.remove('hidden'); }

  // ---------------------------------------------------------------- run / sectors
  startRun() {
    audio.initAudio(this.settings.vol); audio.resume();
    this.applySettings();
    this.won = false;
    this.depth = 1; this.score = 0; this.kills = 0; this.shots = 0; this.hits = 0; this.runStart = performance.now();
    this.combo = 1; this.comboT = 0;
    this.unlocked = [true, false, false, false, false, false];
    this.spin = 0; this.charging = 0;
    this.ammo = WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve }));
    this.player.hp = 100; this.player.shield = 25;
    this.weapon = 0; this.viewmodel.select(0);
    ['title', 'over', 'pause'].forEach(id => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    this.loadSector(1);
    this.lock();
  }

  loadSector(depth) {
    this.depth = depth;
    this.enemies.forEach(e => this.scene.remove(e.mesh)); this.enemies = [];
    (this.corpses || []).forEach(e => this.scene.remove(e.mesh)); this.corpses = [];
    this.fx.clear(); this.projectiles.clear(); this.pickups.clear();
    this.level?.dispose();
    this.level = buildLevel(this.scene, depth, this.quality, this.settings.gore);
    const L = this.level, rand = L.rand;
    this.vmHemi.color.set(L.palette.light).lerp(new THREE.Color(0x9fb8ff), 0.6);
    // face the player down the first corridor-ish direction
    const s = L.centreOf(L.start.cx, L.start.cy);
    this.player.reset(s, Math.atan2(-(L.exitRoom.cx - L.start.cx), -(L.exitRoom.cy - L.start.cy)));
    this.boss = null;
    const isFinal = depth === FINAL_DEPTH, isBoss = depth % 3 === 0 || isFinal;
    this.final.uniforms.dread.value = dreadFor(depth);
    const avoid = [s];
    for (const r of L.rooms.slice(1)) {
      if (isBoss && r === L.exitRoom) continue;
      const cap = isFinal ? 18 : 14 + depth * 2; // the last sector is about the Warden
      const n = Math.min(1 + Math.floor(rand() * 2) + Math.floor(depth / 3) + (L.distFromStart(r) > 18 ? 1 : 0), Math.max(0, cap - this.enemies.length));
      for (let i = 0; i < n; i++) {
        const p = L.randomFloorInRoom(r, avoid); avoid.push(p);
        this.enemies.push(new Enemy(rollEnemy(rand, depth, L.theme), p, this.scene, depth));
      }
      const roll = rand();
      if (roll < 0.3) this.pickups.add('health', L.randomFloorInRoom(r, avoid));
      else if (roll < 0.55) this.pickups.add('shield', L.randomFloorInRoom(r, avoid));
      if (rand() < 0.45) this.pickups.add('ammo', L.randomFloorInRoom(r, avoid));
    }
    if (isBoss) {
      this.boss = new Enemy(isFinal ? 'warden' : L.theme === 'vault' ? 'archivist' : 'hollowking', L.centreOf(L.exitRoom.cx, L.exitRoom.cy), this.scene, depth);
      this.enemies.push(this.boss);
    }
    if (isFinal) { // supplies around the edge of the arena
      const A = L.exitRoom;
      for (const k of ['ammo', 'ammo', 'ammo', 'ammo', 'health', 'health', 'shield', 'shield']) this.pickups.add(k, L.randomFloorInRoom(A, avoid));
      if (this.unlocked[5]) this.pickups.add('cell', L.randomFloorInRoom(L.rooms[Math.floor(L.rooms.length / 2)], avoid));
      this.arenaSupplyT = 20;
    }
    // weapon unlocks placed on the way
    const mid = L.rooms[Math.min(2, L.rooms.length - 1)];
    const roomN = n => L.rooms[Math.min(n, L.rooms.length - 1)];
    if (!this.unlocked[1]) this.pickups.add('scatter', L.randomFloorInRoom(mid, avoid));
    if (!this.unlocked[2] && depth >= 2) this.pickups.add('ripper', L.randomFloorInRoom(roomN(1), avoid));
    if (!this.unlocked[3] && depth >= 2) this.pickups.add('arc', L.randomFloorInRoom(roomN(3), avoid));
    if (!this.unlocked[4] && depth >= 3) this.pickups.add('rail', L.randomFloorInRoom(roomN(2), avoid));
    if (!this.unlocked[5] && depth >= 2) this.pickups.add('bfg', L.randomFloorInRoom(roomN(4), avoid));
    if (this.unlocked[5] && rand() < 0.6) this.pickups.add('cell', L.randomFloorInRoom(roomN(5), avoid));
    this.totalEnemies = this.enemies.length;
    this.revealed = new Uint8Array(L.W * L.H);
    this.sectorStart = performance.now();
    L.exit.setActive(false);
    this.portalOpen = false;
    this.buildMapBase();
    audio.startMusic(depth);
    const name = isFinal ? "THE WARDEN'S HALL" : `${{ vault: 'SECTOR', undercroft: 'UNDERCROFT', pit: 'THE PIT' }[L.theme]} ${String(depth).padStart(2, '0')}`;
    const lines = ['', 'THE VAULT REMEMBERS', 'THE DEAD DO NOT REST', 'THE ARCHIVIST AWAITS', 'SOMETHING IS FEEDING', 'THE ROT HAS REACHED THE VAULT',
      'THE HOLLOW KING HUNGERS', 'LISTEN TO THEM SCREAM', 'NO ONE IS FORGIVEN HERE', 'HE CAME BACK WRONG', 'THE WARDEN WAKES'];
    this.banner(name, lines[depth] || 'DEEPER STILL');
    $('sector').textContent = `${name}  ·  ${depth}/${FINAL_DEPTH}`;
    if (isFinal) setTimeout(() => this.state === 'playing' && this.audio.roar(1.3), 1800);
    this.level.updateFlow(this.player.pos.x, this.player.pos.z);
  }

  banner(h, p) {
    $('bannerh').textContent = h; $('bannerp').textContent = p;
    $('banner').classList.add('show');
    clearTimeout(this.bannerTimer); this.bannerTimer = setTimeout(() => $('banner').classList.remove('show'), 2600);
  }

  feed(msg, color) {
    const d = document.createElement('div'); d.textContent = msg; if (color) d.style.color = color;
    this.feedEl.prepend(d); setTimeout(() => d.remove(), 3300);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
  }

  // ---------------------------------------------------------------- weapons
  switchWeapon(i) {
    if (!this.unlocked[i] || i === this.weapon) return;
    this.weapon = i; this.reloading = 0; this.viewmodel.reloadT = 0; this.viewmodel.select(i); this.fireCd = 0.3; this.spin = 0; this.charging = 0; this.viewmodel.charge = 0;
    this.audio.reload();
  }
  cycleWeapon(dir) { const n = WEAPONS.length; for (let k = 1; k <= n; k++) { const i = (this.weapon + dir * k + n * 10) % n; if (this.unlocked[i]) { this.switchWeapon(i); return; } } }

  reload() {
    const w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
    if (this.reloading > 0 || a.mag === w.mag || a.reserve <= 0) return;
    this.reloading = w.reload; this.viewmodel.startReload(w.reload); this.audio.reload();
  }

  tryFire(fromCharge = false) {
    if (this.fireCd > 0 || this.reloading > 0 || (this.charging > 0 && !fromCharge)) return;
    const w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
    if (a.mag <= 0) { this.audio.empty(); this.fireCd = 0.25; if (a.reserve > 0) this.reload(); return; }
    if (w.spin && this.spin < 1) return;
    if (w.charge && !fromCharge) { this.charging = w.charge; this.audio.bfgCharge(); return; }
    a.mag--; this.fireCd = w.rate; this.shots++;
    this.viewmodel.fire(w.color, w.kick);
    this.audio[w.id]();
    this.shake(w.shake);
    this.player.pitch += w.kick * 0.35 * (0.7 + Math.random() * 0.6);
    this.player.yaw += (Math.random() - 0.5) * w.kick * 0.15;
    $('crosshair').classList.add('spread'); clearTimeout(this.chTimer); this.chTimer = setTimeout(() => $('crosshair').classList.remove('spread'), 120);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const fwd = this.camera.getWorldDirection(new THREE.Vector3());
    const muzzle = this.viewmodel.muzzleWorld();
    this.fx.light(muzzle, w.color, 30, 0.06, 8);
    const moving = Math.hypot(this.player.vel.x, this.player.vel.z) > 7;
    const spread = moving ? w.sprintSpread : w.spread;
    if (w.projectile) {
      const dir = fwd.clone().add(new THREE.Vector3((Math.random() - .5) * spread, (Math.random() - .5) * spread, (Math.random() - .5) * spread)).normalize();
      this.projectiles.fire(muzzle, dir, { owner: 'player', speed: w.speed, dmg: w.dmg, splash: w.splash, color: w.color, size: w.bfg ? 0.9 : 0.3, bfg: w.bfg });
      if (w.bfg) { this.player.knock.addScaledVector(fwd.clone().setY(0).normalize(), -9); this.healFx = 1; }
    } else if (w.pierce) {
      // rail: one beam that passes through every enemy until it hits a wall
      const wall = this.traceWorld(origin, fwd, 150);
      this.raycaster.set(origin, fwd); this.raycaster.far = wall.dist;
      const hits = this.raycaster.intersectObjects(this.enemies.filter(e => !e.dead).map(e => e.hitbox), false);
      const end = origin.clone().addScaledVector(fwd, wall.dist);
      this.fx.tracer(muzzle, end, w.color, 0.09, 0.35); this.fx.tracer(muzzle, end, 0xffffff, 0.03, 0.25);
      for (let t = 1; t < wall.dist; t += 1.2) this.fx.spawn(origin.clone().addScaledVector(fwd, t), new THREE.Vector3().randomDirection().multiplyScalar(0.8), w.color, 0.25, 0.6, -0.3, 1);
      let killed = false;
      const seen = new Set();
      for (const h of hits) { const e = h.object.userData.enemy; if (seen.has(e)) continue; seen.add(e); if (e.damage(w.dmg, this, fwd, { gib: true })) killed = true; this.impactFx(e, h.point, fwd); }
      this.fx.sparks(end, wall.normal, w.color, 14, 6); this.fx.decal(end, wall.normal, 0.5);
      if (seen.size) { this.hits++; this.hitmarker(killed); }
    } else {
      let anyHit = false, killed = false;
      const hitboxes = this.enemies.filter(e => !e.dead).map(e => e.hitbox);
      for (let p = 0; p < w.pellets; p++) {
        const dir = fwd.clone().add(new THREE.Vector3((Math.random() - .5) * 2 * spread, (Math.random() - .5) * 2 * spread, (Math.random() - .5) * 2 * spread)).normalize();
        const wall = this.traceWorld(origin, dir, 120);
        this.raycaster.set(origin, dir); this.raycaster.far = wall.dist;
        const hit = this.raycaster.intersectObjects(hitboxes, false)[0];
        const end = hit ? hit.point : origin.clone().addScaledVector(dir, wall.dist);
        if (p < 4 || Math.random() < 0.3) this.fx.tracer(muzzle, end, w.color, w.pellets > 1 ? 0.02 : 0.03);
        if (hit) {
          const e = hit.object.userData.enemy;
          const falloff = w.pellets > 1 ? Math.max(0.35, 1 - hit.distance / 26) : 1;
          if (e.damage(Math.round(w.dmg * falloff), this, dir)) killed = true;
          anyHit = true;
          this.impactFx(e, hit.point, dir);
        } else if (wall.dist < 120) {
          this.fx.sparks(end, wall.normal, 0xffd9a0, 5, 4);
          if (p < 3) this.fx.decal(end, wall.normal, w.pellets > 1 ? 0.25 : 0.35);
        }
      }
      if (anyHit) { this.hits++; this.hitmarker(killed); }
    }
    if (a.mag === 0 && a.reserve > 0) setTimeout(() => this.reload(), 200);
  }

  /** Blood for flesh, sparks for machines; flesh also splatters the wall behind it. */
  impactFx(e, point, dir) {
    if (!e.organic) { this.fx.sparks(point, dir.clone().negate(), e.t.eye, 6, 5); return; }
    this.fx.bloodSpray(point, dir, 10, 4);
    if (Math.random() < 0.5) this.audio.squelch();
    const back = this.traceWorld(point, dir, 4);
    if (back.dist < 4) this.fx.bloodSplat(point.clone().addScaledVector(dir, back.dist), back.normal, 0.6 + Math.random() * 0.8);
  }

  /** OBLIVION: everything that can see the blast (or you) within range dies. */
  bfgBlast(pos) {
    this.fx.explosion(pos, 0x5dff5d, 12); this.fx.explosion(pos, 0xb8ffb8, 6);
    this.fx.light(pos, 0x5dff5d, 900, 1.2, 45);
    this.audio.bfgBlast(); this.shake(1.6); this.healFx = 1.2;
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.centre.distanceTo(pos);
      const near = d < 12 || (d < 60 && this.level.los(pos.x, pos.z, e.pos.x, e.pos.z));
      const seen = e.pos.distanceTo(this.player.pos) < 60 && this.level.los(this.player.pos.x, this.player.pos.z, e.pos.x, e.pos.z);
      if (!near && !seen) continue;
      this.fx.tracer(near ? pos : this.player.eye.clone().setY(this.player.eye.y - 0.3), e.centre, 0x5dff5d, 0.08, 0.5);
      // the Warden is the one thing the BFG can't erase outright: each blast tears off a third of it
      e.damage(e.t.final ? Math.ceil(e.maxHp * 0.34) : 999999, this, e.centre.sub(pos).setY(0).normalize(), { gib: true });
      this.fx.burst(e.centre, 0x5dff5d, 25, 7, 0.35);
      n++;
    }
    if (n) { this.hits++; this.hitmarker(true); this.feed(`OBLIVION  ·  ${n} ERASED`, '#5dff5d'); }
  }

  addCorpse(e) {
    this.corpses.push(e);
    while (this.corpses.length > 35) { const old = this.corpses.shift(); this.scene.remove(old.mesh); }
  }

  hitmarker(kill) {
    const h = $('hitmark'); h.classList.toggle('kill', kill); h.style.opacity = 1;
    clearTimeout(this.hmTimer); this.hmTimer = setTimeout(() => (h.style.opacity = 0), kill ? 260 : 120);
    this.audio.hit();
  }

  /** March a ray through the grid, floor and ceiling. */
  traceWorld(o, d, max) {
    const step = 0.08; const p = o.clone(); let prev = o.clone();
    for (let t = 0; t < max; t += step) {
      p.copy(o).addScaledVector(d, t);
      if (p.y <= 0.001) return { dist: t, normal: new THREE.Vector3(0, 1, 0) };
      if (p.y >= WALL_H) return { dist: t, normal: new THREE.Vector3(0, -1, 0) };
      if (this.level.isSolid(p.x, p.z)) {
        const [pcx, pcz] = this.level.cellOf(prev.x, prev.z), [ccx, ccz] = this.level.cellOf(p.x, p.z);
        const n = ccx !== pcx ? new THREE.Vector3(Math.sign(pcx - ccx), 0, 0) : new THREE.Vector3(0, 0, Math.sign(pcz - ccz) || 1);
        return { dist: Math.max(0, t - step * 0.5), normal: n };
      }
      prev.copy(p);
    }
    return { dist: max, normal: new THREE.Vector3(0, 1, 0) };
  }

  explodeAt(pos, dmg, radius, color) {
    this.fx.explosion(pos, color, radius);
    this.fx.decal(new THREE.Vector3(pos.x, 0.02, pos.z), new THREE.Vector3(0, 1, 0), radius * 0.7);
    this.audio.explode();
    let killed = false, any = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.centre.distanceTo(pos);
      if (d < radius + e.t.radius && this.level.los(pos.x, pos.z, e.pos.x, e.pos.z)) {
        const k = 1 - Math.max(0, d - e.t.radius) / radius;
        if (e.damage(Math.round(dmg * (0.35 + 0.65 * k)), this, e.centre.sub(pos).setY(0).normalize(), { explosive: k > 0.4 })) killed = true;
        any = true;
      }
    }
    if (any) { this.hits++; this.hitmarker(killed); }
    const pd = this.player.eye.distanceTo(pos);
    this.shake(Math.max(0, 1.2 - pd / (radius * 2.5)));
    if (pd < radius * 0.7) this.hurtPlayer(dmg * 0.18 * (1 - pd / (radius * 0.7)), pos, 8);
  }

  // ---------------------------------------------------------------- damage / events
  hurtPlayer(dmg, from, knock = 3) {
    const P = this.player;
    if (this.state !== 'playing' || P.invuln > 0 || this.won) return;
    dmg = Math.round(dmg * (1 + (this.depth - 1) * 0.05));
    const absorbed = Math.min(P.shield, Math.round(dmg * 0.7));
    P.shield -= absorbed; P.hp -= dmg - absorbed;
    this.damageFx = Math.min(1, this.damageFx + 0.55);
    this.shake(0.35 + dmg / 40);
    if (from) P.knock.add(new THREE.Vector3(P.pos.x - from.x, 0, P.pos.z - from.z).normalize().multiplyScalar(knock));
    this.audio.hurt();
    this.combo = 1;
    if (P.hp <= 0) { P.hp = 0; if (!this.won) this.gameOver(false); }
  }

  onEnemyKilled(e) {
    this.kills++;
    this.comboT = 3;
    const gained = e.t.score * this.combo;
    this.score += gained;
    this.feed(`${e.type.toUpperCase()} PURGED  +${gained}${this.combo > 1 ? `  x${this.combo}` : ''}`);
    this.combo = Math.min(this.combo + 1, 6);
    this.audio.kill();
    if (!e.organic) { this.fx.burst(e.centre, e.t.eye, e.type === 'archivist' ? 160 : 45, e.type === 'archivist' ? 16 : 9, e.type === 'archivist' ? 0.6 : 0.3); this.fx.light(e.centre, e.t.eye, e.type === 'archivist' ? 300 : 60, 0.35, 10); }
    if (e.type === 'archivist') { this.fx.explosion(e.centre, 0xff2e88, 9); this.shake(1.5); this.banner('ARCHIVIST DESTROYED', 'THE VAULT FORGETS'); this.score += 5000 * this.depth; }
    if (e.type === 'warden') { this.wardenDown(e); return; }
    if (e.type === 'hollowking') { this.fx.gibBurst(e.centre, 30, 9); this.fx.bloodSpray(e.centre, new THREE.Vector3(0, 1, 0), 80, 9); this.shake(1.5); this.banner('THE HOLLOW KING FALLS', 'THE DEAD GO QUIET'); this.score += 5000 * this.depth; }
    const r = Math.random();
    if (!e.minion || r < 0.2) {
      if (r < 0.18) this.pickups.add('ammo', e.pos);
      else if (r < 0.3) this.pickups.add('health', e.pos);
      else if (r < 0.38) this.pickups.add('shield', e.pos);
    }
  }

  onBossPhase(e, ph) {
    this.shake(1.2); this.audio.roar(1.2);
    this.banner(ph === 2 ? 'THE WARDEN BLEEDS' : 'THE WARDEN IS ENRAGED', ph === 2 ? 'THE DAMNED ANSWER HIS CALL' : 'IT WILL NOT LET YOU LEAVE');
  }

  /** The final kill: the Warden comes apart, everything else in the sector drops dead, and the run is won. */
  wardenDown(e) {
    this.won = true; this.score += 25000 + 5000 * this.depth;
    this.fx.gibBurst(e.centre, 40, 11); this.fx.bloodSpray(e.centre, new THREE.Vector3(0, 1, 0), 120, 12);
    this.fx.explosion(e.centre, 0xff3010, 12); this.fx.light(e.centre, 0xff3010, 800, 1.5, 40);
    this.shake(1.6); this.audio.roar(1.6);
    this.banner('THE WARDEN IS DEAD', 'THE SCREAMING STOPS');
    for (const o of this.enemies) if (!o.dead && o !== e) o.damage(999999, this, null, { gib: true });
    setTimeout(() => this.victory(), 4200);
  }

  victory() {
    if (this.state === 'over') return;
    this.state = 'over'; this.mouseDown = false;
    document.exitPointerLock?.();
    audio.stopMusic();
    const secs = Math.round((performance.now() - this.runStart) / 1000);
    const acc = this.shots ? Math.round(this.hits / this.shots * 100) : 0;
    const best = Math.max(this.score, Number(store.get('ns-best') || 0));
    store.set('ns-best', best);
    $('overtitle').textContent = 'YOU ESCAPED';
    $('overtag').textContent = 'The Warden is dead. The damned are finally quiet.';
    $('stats').innerHTML = `SCORE <b>${this.score.toLocaleString()}</b><br>ALL ${FINAL_DEPTH} SECTORS CLEARED &nbsp; · &nbsp; KILLS <b>${this.kills}</b><br>ACCURACY <b>${acc}%</b> &nbsp; · &nbsp; TIME <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b><br>BEST <b>${best.toLocaleString()}</b>`;
    $('pause').classList.add('hidden'); $('hud').classList.add('hidden'); $('over').classList.remove('hidden');
  }

  spawnMinions(pos, n, type = 'skitter') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, p = pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
      if (this.level.isSolid(p.x, p.z)) continue;
      const e = new Enemy(type, p, this.scene, this.depth); e.minion = true; e.state = 'chase';
      this.enemies.push(e); this.fx.burst(p.clone().setY(0.6), 0xff2e88, 20, 5, 0.3);
    }
  }

  tryPickup(p) {
    const P = this.player;
    if (p.kind === 'health') { if (P.hp >= P.maxHp) return false; P.hp = Math.min(P.maxHp, P.hp + 25); }
    else if (p.kind === 'shield') { if (P.shield >= 100) return false; P.shield = Math.min(100, P.shield + 35); }
    else if (p.kind === 'ammo') {
      let took = false;
      WEAPONS.forEach((w, i) => { if (!this.unlocked[i] || w.bfg) return; const a = this.ammo[i]; if (a.reserve < w.maxReserve) { a.reserve = Math.min(w.maxReserve, a.reserve + Math.ceil(w.mag * (i === 0 ? 2 : 1.5))); took = true; } });
      if (!took) return false;
    } else if (p.kind === 'cell') {
      const a = this.ammo[5]; if (a.reserve + a.mag >= WEAPONS[5].maxReserve) return false; a.reserve++;
    } else if (p.weapon !== undefined) {
      this.unlocked[p.weapon] = true; this.switchWeapon(p.weapon); this.banner(WEAPONS[p.weapon].name, 'ACQUIRED');
    }
    this.feed(p.label, '#' + p.color.toString(16).padStart(6, '0'));
    this.audio.pickup(); this.healFx = 0.6;
    return true;
  }

  shake(n) { this.shakeAmt = Math.min(1.6, this.shakeAmt + n); }

  gameOver(quit) {
    this.state = 'over'; this.mouseDown = false;
    document.exitPointerLock?.();
    audio.stopMusic();
    const secs = Math.round((performance.now() - this.runStart) / 1000);
    const acc = this.shots ? Math.round(this.hits / this.shots * 100) : 0;
    const best = Math.max(this.score, Number(store.get('ns-best') || 0));
    store.set('ns-best', best);
    $('overtitle').textContent = quit ? 'RUN ABANDONED' : 'SIGNAL LOST';
    $('overtag').textContent = quit ? 'You surfaced. For now.' : 'The vault keeps you';
    $('stats').innerHTML = `SCORE <b>${this.score.toLocaleString()}</b><br>SECTOR REACHED <b>${this.depth}</b> &nbsp; · &nbsp; GLITCHBORN PURGED <b>${this.kills}</b><br>ACCURACY <b>${acc}%</b> &nbsp; · &nbsp; TIME <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b><br>BEST <b>${best.toLocaleString()}</b>`;
    $('pause').classList.add('hidden'); $('hud').classList.add('hidden'); $('over').classList.remove('hidden');
  }

  // ---------------------------------------------------------------- per-frame
  frame() {
    const raw = this.clock.getDelta(), dt = Math.min(raw, 0.05);
    this.time += dt;
    this.adaptResolution(raw);
    if (this.state === 'playing') this.update(dt);
    else if (this.state === 'title') this.titleCam(dt);
    this.level?.update(this.time);
    this.fx.update(this.state === 'playing' || this.state === 'title' ? dt : 0);
    // camera shake
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 3);
    const s = this.shakeAmt * this.shakeAmt * 0.06;
    this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.rotation.z += (Math.random() - 0.5) * s * 0.4;
    this.camera.fov = this.settings.fov + this.player.fovKick + (this.player.sprinting ? 6 : 0);
    this.camera.updateProjectionMatrix();
    this.vmCamera.position.copy(this.camera.position); this.vmCamera.quaternion.copy(this.camera.quaternion);
    this.damageFx = Math.max(0, this.damageFx - dt * 1.4); this.healFx = Math.max(0, this.healFx - dt * 1.5);
    this.final.uniforms.time.value = this.time;
    this.final.uniforms.damage.value = this.damageFx;
    this.final.uniforms.heal.value = this.healFx;
    this.composer.render(dt);
  }

  /** Keep the frame rate up: nudge the render resolution every 2 seconds. */
  adaptResolution(raw) {
    if (this.state !== 'playing' || raw > 0.5) return;
    const P = this.perf; P.acc += raw; P.n++;
    if (P.acc < 2) return;
    P.fps = P.n / P.acc; P.acc = 0; P.n = 0;
    const max = this.quality === 'high' ? Math.min(devicePixelRatio, 1.5) : this.quality === 'medium' ? 0.85 : 0.7;
    let s = this.pixelScale;
    if (P.fps < 45 && s > 0.55) s = Math.max(0.55, s - 0.1);
    else if (P.fps > 70 && s < max) s = Math.min(max, s + 0.05);
    if (s !== this.pixelScale) { this.pixelScale = s; this.renderer.setPixelRatio(s); this.composer.setPixelRatio?.(s); this.resize(); }
    $('fps').textContent = `${Math.round(P.fps)} FPS  ·  ${Math.round(s * 100)}% RES`;
  }

  titleCam(dt) {
    const L = this.level, r = L.rooms[0];
    const t = this.time * 0.12;
    this.camera.position.set(r.cx * CELL + CELL / 2 + Math.cos(t) * 5, 2.4, r.cy * CELL + CELL / 2 + Math.sin(t) * 5);
    this.camera.rotation.set(-0.08, -t - Math.PI / 2, 0, 'YXZ');
    this.viewmodel.root.visible = false;
  }

  update(dt) {
    const P = this.player, L = this.level;
    this.viewmodel.root.visible = true;
    const { speed, lookDelta } = P.update(dt, L, this.audio);
    this.viewmodel.update(dt, speed, lookDelta, P.sprinting, P.grounded);

    // weapons
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { const w = WEAPONS[this.weapon], a = this.ammo[this.weapon], n = Math.min(w.mag - a.mag, a.reserve); a.mag += n; a.reserve -= n; }
    }
    const cw = WEAPONS[this.weapon];
    if (cw.spin) {
      if (this.mouseDown && this.spin === 0) this.audio.spinup();
      this.spin = this.mouseDown ? Math.min(1, this.spin + dt / cw.spin) : Math.max(0, this.spin - dt * 1.5); this.viewmodel.spin = this.spin;
    }
    if (this.charging > 0) {
      this.charging -= dt; this.viewmodel.charge = 1 - Math.max(0, this.charging) / (cw.charge || 1); this.shake(dt * 0.8);
      if (this.charging <= 0) { this.charging = 0; this.tryFire(true); this.viewmodel.charge = 0; }
    }
    if (this.mouseDown && cw.auto) this.tryFire();

    // AI + world
    this.flowT -= dt; if (this.flowT <= 0) { L.updateFlow(P.pos.x, P.pos.z); this.flowT = 0.35; }
    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter(e => !e.removed);
    this.projectiles.update(dt, this);
    this.pickups.update(dt, this);
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 1;
    audio.ambience(dt, this.depth);
    if (this.depth === FINAL_DEPTH && !this.won) { // keep the arena stocked while the Warden lives
      this.arenaSupplyT -= dt;
      if (this.arenaSupplyT <= 0) { this.arenaSupplyT = 20; if (this.pickups.list.filter(p => p.kind === 'ammo').length < 3) this.pickups.add(Math.random() < 0.7 ? 'ammo' : 'health', L.randomFloorInRoom(L.exitRoom)); }
    }

    // sector objective
    const alive = this.enemies.filter(e => !e.dead).length;
    if (!this.portalOpen && alive === 0 && this.depth !== FINAL_DEPTH) {
      this.portalOpen = true; L.exit.setActive(true); this.audio.portal();
      this.banner('SECTOR PURGED', 'EXIT PORTAL ONLINE');
      const secs = (performance.now() - this.sectorStart) / 1000;
      const bonus = 1000 * this.depth + Math.max(0, Math.round((240 - secs) * 10));
      this.score += bonus; this.feed(`SECTOR BONUS +${bonus}`, '#5dff8f');
    }
    $('objective').textContent = this.won ? 'The Warden is dead' : this.boss && !this.boss.dead ? `Destroy ${{ hollowking: 'THE HOLLOW KING', archivist: 'THE ARCHIVIST', warden: 'THE WARDEN' }[this.boss.type]}  ·  ${Math.max(0, Math.ceil(this.boss.hp / this.boss.maxHp * 100))}%` : this.portalOpen ? 'Reach the exit portal' : `Purge the Glitchborn  ·  ${alive} remain`;
    if (this.portalOpen) {
      const ex = L.exit.group.position;
      if (Math.hypot(P.pos.x - ex.x, P.pos.z - ex.z) < 1.9) {
        this.audio.descend(); this.healFx = 1; this.state = 'transition';
        setTimeout(() => { this.player.hp = Math.min(100, this.player.hp + 20); this.loadSector(this.depth + 1); this.state = 'playing'; this.clock.getDelta(); }, 700);
      }
    }
    this.updateHud(dt);
  }

  updateHud(dt) {
    const P = this.player, w = WEAPONS[this.weapon], a = this.ammo[this.weapon];
    $('hpnum').textContent = Math.ceil(P.hp); $('arnum').textContent = Math.ceil(P.shield);
    $('hpbar').firstElementChild.style.width = `${P.hp}%`; $('arbar').firstElementChild.style.width = `${P.shield}%`;
    $('ammo').innerHTML = `${a.mag}<small> / ${a.reserve}</small>`;
    $('wname').textContent = w.name; $('wname').style.color = '#' + w.color.toString(16).padStart(6, '0');
    document.querySelectorAll('#slots span').forEach(s => { const i = Number(s.dataset.s); s.classList.toggle('on', i === this.weapon); s.classList.toggle('locked', !this.unlocked[i]); });
    $('scorenum').textContent = this.score.toLocaleString();
    $('combo').textContent = this.combo > 1 && this.comboT > 0 ? `COMBO x${this.combo}` : '';
    $('lowhp').style.opacity = P.hp < 30 ? 1 : 0;
    $('dmg').style.opacity = this.damageFx;
    $('reloadtip').classList.toggle('hidden', !(this.reloading > 0 || (a.mag === 0 && a.reserve === 0)));
    $('reloadtip').textContent = this.reloading > 0 ? 'RELOADING' : 'NO AMMUNITION';
    this.mapT -= dt; if (this.mapT <= 0) { this.drawMap(); this.mapT = 0.05; }
  }

  // ---------------------------------------------------------------- maps
  buildMapBase() {
    this.mapCanvas = $('minimap'); this.mapCtx = this.mapCanvas.getContext('2d');
    this.bigCanvas = $('bigmap'); this.bigCtx = this.bigCanvas.getContext('2d');
  }

  toggleBigMap(open = !this.bigMapOpen) {
    this.bigMapOpen = open;
    $('bigmap').classList.toggle('hidden', !open); $('bigmaptip').classList.toggle('hidden', !open);
    if (open) this.drawMap();
  }

  drawMap() {
    const L = this.level, P = this.player;
    const [pcx, pcy] = L.cellOf(P.pos.x, P.pos.z);
    for (let y = pcy - 4; y <= pcy + 4; y++) for (let x = pcx - 4; x <= pcx + 4; x++) if (x >= 0 && y >= 0 && x < L.W && y < L.H && L.los(P.pos.x, P.pos.z, x * CELL + 2, y * CELL + 2)) this.revealed[y * L.W + x] = 1;
    this.renderMap(this.mapCtx, this.mapCanvas.width, 26, true);
    if (this.bigMapOpen) this.renderMap(this.bigCtx, this.bigCanvas.width, Math.max(L.W, L.H) + 2, false);
  }

  /**
   * Draw the sector. follow: minimap centred on the player and turning with them, with anything out of view
   * pinned to the edge; otherwise the whole sector, north up. Every enemy and pickup is always shown.
   */
  renderMap(ctx, S, view, follow) {
    const L = this.level, P = this.player, scale = S / view, u = follow ? 1 : 1.25;
    const ox = follow ? P.pos.x / CELL - view / 2 : (L.W - view) / 2, oy = follow ? P.pos.z / CELL - view / 2 : (L.H - view) / 2;
    const cos = Math.cos(P.yaw), sin = Math.sin(P.yaw), C = S / 2;
    // world position -> screen, turning with the player on the minimap
    const toScreen = (wx, wz) => {
      const x = (wx / CELL - ox) * scale, y = (wz / CELL - oy) * scale;
      if (!follow) return [x, y];
      const dx = x - C, dy = y - C;
      return [C + dx * cos - dy * sin, C + dx * sin + dy * cos];
    };
    ctx.clearRect(0, 0, S, S);
    // ---- layout: every floor cell (explored ones brighter), walls outlined
    ctx.save();
    if (follow) { ctx.translate(C, C); ctx.rotate(P.yaw); ctx.translate(-C, -C); }
    const x0 = follow ? Math.floor(ox) - 5 : 0, x1 = follow ? ox + view + 5 : L.W, y0 = follow ? Math.floor(oy) - 5 : 0, y1 = follow ? oy + view + 5 : L.H;
    const solid = (x, y) => x < 0 || y < 0 || x >= L.W || y >= L.H || L.grid[y * L.W + x] !== 0;
    ctx.lineWidth = Math.max(2, scale * 0.12); ctx.strokeStyle = 'rgba(140,225,255,0.95)';
    ctx.beginPath();
    for (let y = Math.max(0, y0); y < Math.min(L.H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(L.W, x1); x++) {
      const v = L.grid[y * L.W + x], sx = (x - ox) * scale, sy = (y - oy) * scale;
      if (v === 2) { ctx.fillStyle = 'rgba(255,190,90,0.7)'; ctx.fillRect(sx + scale * 0.15, sy + scale * 0.15, scale * 0.7, scale * 0.7); continue; }
      if (v !== 0) continue;
      ctx.fillStyle = this.revealed[y * L.W + x] ? 'rgba(70,130,185,0.62)' : 'rgba(70,130,185,0.26)';
      ctx.fillRect(sx, sy, scale + 0.6, scale + 0.6);
      if (solid(x, y - 1)) { ctx.moveTo(sx, sy); ctx.lineTo(sx + scale, sy); }
      if (solid(x, y + 1)) { ctx.moveTo(sx, sy + scale); ctx.lineTo(sx + scale, sy + scale); }
      if (solid(x - 1, y)) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + scale); }
      if (solid(x + 1, y)) { ctx.moveTo(sx + scale, sy); ctx.lineTo(sx + scale, sy + scale); }
    }
    ctx.stroke();
    ctx.restore();
    // ---- markers (pinned to the edge of the minimap when out of view)
    const edge = 12;
    const place = (wx, wz) => {
      let [x, y] = toScreen(wx, wz), off = false;
      if (follow && (x < edge || y < edge || x > S - edge || y > S - edge)) {
        const dx = x - C, dy = y - C, k = (C - edge) / Math.max(Math.abs(dx), Math.abs(dy)); x = C + dx * k; y = C + dy * k; off = true;
      }
      return [x, y, off];
    };
    const dot = (x, y, r, fill, line = '#fff', lw = 2.5) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); };
    const diamond = (x, y, r, fill, line = '#fff', lw = 2.5) => { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); };
    const hex = c => '#' + c.toString(16).padStart(6, '0');
    // exit portal
    if (L.exit.group.visible) { const ex = L.exit.group.position, [x, y, off] = place(ex.x, ex.z); dot(x, y, (off ? 7 : 11) * u, this.portalOpen ? '#5dff8f' : 'rgba(56,242,255,0.5)', this.portalOpen ? '#fff' : '#38f2ff', 3); }
    // pickups: diamonds; weapons bigger with a thick white rim
    for (const p of this.pickups.list) {
      const [x, y, off] = place(p.g.position.x, p.g.position.z), weapon = p.weapon !== undefined;
      diamond(x, y, (off ? 6 : weapon ? 11 : 8) * u, hex(p.color), '#fff', weapon ? 4 : 2.2);
    }
    // enemies: red dots with a dark rim; bosses big and yellow with a pulsing ring
    const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const [x, y, off] = place(e.pos.x, e.pos.z);
      if (e.t.boss) { dot(x, y, (off ? 9 : 15) * u, '#ffd400', '#ff2a3a', 4); ctx.beginPath(); ctx.arc(x, y, (off ? 13 : 21 + pulse * 6) * u, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,60,40,${0.4 + pulse * 0.5})`; ctx.lineWidth = 3; ctx.stroke(); }
      else dot(x, y, (off ? 5 : 7.5) * u, e.state === 'idle' ? '#c01828' : '#ff2a3a', '#1a0000', 2.2);
    }
    // player
    const [px, py] = follow ? [C, C] : toScreen(P.pos.x, P.pos.z);
    ctx.save(); ctx.translate(px, py); if (!follow) ctx.rotate(-P.yaw);
    const a = 14 * u; ctx.beginPath(); ctx.moveTo(0, -a); ctx.lineTo(-a * 0.65, a * 0.75); ctx.lineTo(0, a * 0.4); ctx.lineTo(a * 0.65, a * 0.75); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
  }
}

// kick off
$('loading').textContent = 'COMPILING VAULT…';
requestAnimationFrame(() => {
  const g = new Game(); $('loading').textContent = '';
  // developer test hook: ?autotest=<sector>&shot=<enemy type> jumps straight in for screenshots
  const q = new URLSearchParams(location.search);
  if (q.has('autotest')) {
    try {
      g.startRun(); g.loadSector(Number(q.get('autotest')) || 2); g.player.invuln = 1e9;
      clearTimeout(g.bannerTimer); $('banner').classList.remove('show');
      g.unlocked = [true, true, true, true, true, true]; g.switchWeapon(Number(q.get('weapon') || 0)); g.viewmodel.switchT = 0;
      const want = q.get('shot'), L = g.level;
      const e = g.enemies.find(x => x.type === want) || g.enemies.find(x => x.organic) || g.enemies[0];
      let spot = null;
      const k = Math.max(1, e.t.radius * 1.6);
      for (const d of [5, 6, 4, 7, 3].map(v => Math.round(v * k))) for (const [dx, dz] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const x = e.pos.x + dx, z = e.pos.z + dz; if (!spot && !L.isSolid(x, z) && L.los(x, z, e.pos.x, e.pos.z)) spot = [x, z]; }
      if (spot) g.player.pos.set(spot[0], 0, spot[1]);
      const c = e.centre, eye = g.player.eye;
      g.player.yaw = Math.atan2(-(c.x - eye.x), -(c.z - eye.z)); g.player.pitch = Math.atan2(c.y - eye.y, Math.hypot(c.x - eye.x, c.z - eye.z)) - 0.05;
      e.state = 'chase';
      if (q.has('prop')) { // look at a piece of set dressing instead (e.g. prop=writhe for a shackled prisoner)
        let found = null; L.group.traverse(o => { if (!found && o.userData[q.get('prop')]) found = o; });
        if (found) { const p = found.getWorldPosition(new THREE.Vector3()), f = new THREE.Vector3(0, 0, 1).applyQuaternion(found.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
          g.player.pos.set(p.x + f.x * 3.2, 0, p.z + f.z * 3.2); g.player.yaw = Math.atan2(f.x, f.z); g.player.pitch = 0.05; g.enemies.forEach(x => { x.state = 'idle'; }); }
      }
      if (q.has('map')) g.toggleBigMap(true);
      window.__autotest = { type: e.type, theme: L.theme, enemies: g.enemies.map(x => x.type).join(',') };
      console.log('AUTOTEST ' + JSON.stringify(window.__autotest));
      if (q.has('kill')) setTimeout(() => {
        const sync = () => { g.scene.updateMatrixWorld(); g.vmCamera.position.copy(g.camera.position); g.vmCamera.quaternion.copy(g.camera.quaternion); g.vmScene.updateMatrixWorld(); };
        sync(); g.fireCd = 0; g.reloading = 0; g.mouseDown = true; g.tryFire();
        for (let i = 0; i < 180; i++) { g.update(1 / 60); g.fx.update(1 / 60); sync(); if (i === 90) g.mouseDown = false; }
      }, 1500);
      if (q.has('win')) setTimeout(() => { // wear the boss down through every phase, simulating in between, then check the ending
        const log = [];
        for (let k = 0; k < 4; k++) { if (g.boss.dead) break; g.boss.damage(Math.ceil(g.boss.maxHp * 0.3), g, null); for (let i = 0; i < 240; i++) g.update(1 / 60); log.push(`phase ${g.boss.phase} hp ${Math.max(0, g.boss.hp)} enemies ${g.enemies.filter(x => !x.dead).length} shots ${g.projectiles.list.length}`); }
        setTimeout(() => console.log('WIN ' + JSON.stringify({ log, won: g.won, state: g.state, title: $('overtitle').textContent, score: g.score })), 4600);
      }, 1500);
      if (q.has('report')) setTimeout(() => console.log('REPORT ' + JSON.stringify({ kills: g.kills, alive: g.enemies.filter(x => !x.dead).length, total: g.totalEnemies, corpses: g.corpses.length, boss: g.boss ? Math.round(g.boss.hp / g.boss.maxHp * 100) + '%' : null, gibs: g.fx.gibs.length, decals: g.fx.decals.length, ammo: g.ammo[g.weapon], score: g.score })), Number(q.get('report')) || 7000);
    } catch (err) { console.error('AUTOTEST FAILED ' + err.stack); }
  }
});
window.addEventListener('error', ev => console.error('PAGE ERROR ' + ev.message + ' @' + ev.filename + ':' + ev.lineno));
