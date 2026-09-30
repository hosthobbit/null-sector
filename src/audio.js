// All sound is synthesised live with Web Audio: no audio files.
let ctx = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null, reverb = null;
let musicTimer = null;

export function initAudio(volume = 0.7) {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(comp);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // simple convolution reverb from decaying noise (big concrete vault)
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  reverb.buffer = ir;
  const rv = ctx.createGain(); rv.gain.value = 0.28; reverb.connect(rv); rv.connect(comp);
}

export function setVolume(v) { if (master) master.gain.value = v; }
export function resume() { ctx?.resume(); }
export function suspend() { ctx?.suspend(); }

function out(node, wet = 0.5) {
  node.connect(sfxGain);
  if (wet > 0) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(reverb); }
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function noise(t, dur, filterType, freq, q, peak, wet = 0.4) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.003, peak, dur);
  src.connect(f); f.connect(g); out(g, wet);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
  return f;
}

function tone(t, type, f0, f1, dur, peak, wet = 0.3) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  o.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  carbine() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 900, 120, 0.09, 0.22); noise(t, 0.08, 'bandpass', 2600, 1.2, 0.5); tone(t, 'sine', 160, 50, 0.12, 0.5, 0.1); },
  scatter() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.35, 'lowpass', 1800, 0.7, 1.2, 0.6); tone(t, 'sine', 110, 35, 0.28, 0.9, 0.2); noise(t + 0.02, 0.18, 'highpass', 4000, 0.5, 0.25); },
  arc() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 220, 880, 0.22, 0.25, 0.5); tone(t, 'sine', 70, 40, 0.3, 0.6, 0.2); noise(t, 0.2, 'bandpass', 1200, 4, 0.3); },
  ripper() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 520, 200, 0.05, 0.14, 0.2); noise(t, 0.045, 'bandpass', 3200, 1.5, 0.35, 0.2); },
  spinup() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 60, 260, 0.35, 0.15, 0.2); },
  rail() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 2400, 80, 0.5, 0.35, 0.7); noise(t, 0.4, 'highpass', 2000, 0.7, 0.6, 0.6); tone(t, 'sine', 60, 30, 0.6, 0.9, 0.3); },
  bfgCharge() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 40, 900, 0.9, 0.35, 0.6); tone(t, 'sine', 80, 1600, 0.9, 0.25, 0.6); },
  bfg() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', 300, 60, 0.7, 0.8, 0.8); noise(t, 0.6, 'lowpass', 1200, 0.8, 0.9, 0.8); },
  bfgBlast() { if (!ctx) return; const t = ctx.currentTime; noise(t, 2.2, 'lowpass', 700, 0.5, 1.6, 1); tone(t, 'sine', 70, 18, 2, 1.4, 0.9); tone(t, 'sawtooth', 1200, 40, 1.4, 0.4, 1); noise(t, 0.5, 'highpass', 3000, 0.5, 0.6, 0.8); },
  squelch() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.18, 'lowpass', 450 + Math.random() * 300, 3, 0.55, 0.3); tone(t, 'sine', 120, 50, 0.15, 0.3, 0.2); },
  shriek() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 900, 1400, 0.35, 0.16, 0.8); tone(t, 'square', 1300, 700, 0.4, 0.08, 0.8); noise(t, 0.35, 'bandpass', 2500, 4, 0.25, 0.8); },
  spit() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.25, 'bandpass', 900, 2, 0.4, 0.5); tone(t, 'sine', 400, 150, 0.2, 0.2, 0.4); },
  explode() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.9, 'lowpass', 900, 0.6, 1.4, 0.8); tone(t, 'sine', 90, 25, 0.8, 1.1, 0.4); noise(t, 0.3, 'bandpass', 3000, 1, 0.4); },
  empty() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 1800, 1700, 0.03, 0.08, 0); },
  reload() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.06, 'bandpass', 3000, 3, 0.35, 0.1); noise(t + 0.35, 0.05, 'bandpass', 2200, 3, 0.4, 0.1); tone(t + 0.36, 'square', 600, 500, 0.04, 0.1, 0); },
  hit() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'triangle', 1400, 900, 0.05, 0.18, 0); },
  kill() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 600, 60, 0.4, 0.3, 0.6); noise(t, 0.4, 'bandpass', 800, 2, 0.5, 0.6); tone(t + 0.05, 'square', 1200, 2400, 0.08, 0.12, 0.3); },
  hurt() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 140, 60, 0.25, 0.45, 0.2); noise(t, 0.15, 'lowpass', 600, 1, 0.5, 0.1); },
  pickup() { if (!ctx) return; const t = ctx.currentTime; [0, 0.06, 0.12].forEach((d, i) => tone(t + d, 'triangle', 660 * (1 + i * 0.26), 700 * (1 + i * 0.26), 0.1, 0.18, 0.4)); },
  dash() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.3, 'bandpass', 1200, 0.8, 0.5, 0.5).frequency.exponentialRampToValueAtTime(6000, t + 0.25); },
  step(sprint) { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.05, 'lowpass', sprint ? 700 : 500, 1, sprint ? 0.22 : 0.14, 0.15); },
  land() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.12, 'lowpass', 400, 1, 0.5, 0.2); },
  enemyShot() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', 1300, 300, 0.25, 0.2, 0.5); },
  growl(pitch = 1) { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sawtooth', 70 * pitch, 45 * pitch, 0.6, 0.18, 0.7); noise(t, 0.5, 'bandpass', 300 * pitch, 3, 0.2, 0.7); },
  alert() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'square', 440, 880, 0.12, 0.1, 0.5); tone(t + 0.13, 'square', 880, 440, 0.12, 0.1, 0.5); },
  portal() { if (!ctx) return; const t = ctx.currentTime; [0, 0.1, 0.2, 0.3].forEach((d, i) => tone(t + d, 'sine', 330 * 2 ** (i / 4), 340 * 2 ** (i / 4), 0.5, 0.22, 0.9)); },
  roar(big = 1) { if (!ctx) return; const t = ctx.currentTime; // the Warden: a huge distorted bellow with a scream buried in it
    voice(t, { contour: [55, 80, 95, 90, 70, 45], dur: 2.2 * big, formants: VOWEL.ah, vib: 4, vibDepth: 0.06, jitter: 0.15, breath: 0.6, gain: 0.9, far: 0.15 });
    voice(t + 0.1, { contour: [110, 160, 190, 170, 120], dur: 2 * big, formants: VOWEL.oh, vib: 5, vibDepth: 0.05, jitter: 0.12, breath: 0.4, gain: 0.5, far: 0.2 });
    voice(t + 0.3, { contour: [700, 1100, 1300, 1000, 600], dur: 1.6 * big, formants: VOWEL.ah, vib: 7, vibDepth: 0.04, jitter: 0.1, breath: 0.3, gain: 0.12, far: 0.3 });
    noise(t, 1.8 * big, 'lowpass', 400, 1, 0.7, 0.8); },
  descend() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', 80, 400, 1.4, 0.5, 0.9); noise(t, 1.4, 'bandpass', 500, 1, 0.5, 0.9).frequency.exponentialRampToValueAtTime(5000, t + 1.3); },
};

// ------------------------------------------------------------------ horror ambience
// Distant voices of the damned: synthesised screams, howls, moans, sobbing, whips and chains.
// Everything is scheduled from the game loop (ambience()), so it stops when the game is paused.

/** A vocal sound: sawtooth + breath through vowel formants, with a pitch contour, vibrato and jitter. */
function voice(t, { contour, dur, formants, vib = 5.5, vibDepth = 0.02, breath = 0.15, gain = 0.3, pan = 0, far = 0.5, jitter = 0.03, type = 'sawtooth' }) {
  const o = ctx.createOscillator(); o.type = type;
  const n = 64, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * (contour.length - 1), k = Math.floor(x), f = x - k;
    const a = contour[k], b = contour[Math.min(k + 1, contour.length - 1)];
    curve[i] = (a + (b - a) * f) * (1 + (Math.random() - 0.5) * jitter);
  }
  o.frequency.setValueCurveAtTime(curve, t, dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = vib * (0.85 + Math.random() * 0.3); lg.gain.value = contour[0] * vibDepth;
  lfo.connect(lg); lg.connect(o.frequency);
  const src = ctx.createGain(); o.connect(src);
  const br = ctx.createBufferSource(); br.buffer = noiseBuf; const bg = ctx.createGain(); bg.gain.value = breath; br.connect(bg); bg.connect(src);
  const sum = ctx.createGain(); sum.gain.value = 1;
  for (const [f, q, g] of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const fg = ctx.createGain(); fg.gain.value = g; src.connect(bp); bp.connect(fg); fg.connect(sum); }
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200 - far * 4200;
  const amp = ctx.createGain(), e = new Float32Array(32);
  for (let i = 0; i < 32; i++) { const x = i / 31; e[i] = gain * Math.min(1, x / 0.08) * Math.min(1, (1 - x) / 0.35) * (0.8 + Math.random() * 0.2); }
  e[0] = 0; e[31] = 0;
  amp.gain.setValueCurveAtTime(e, t, dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  sum.connect(lp); lp.connect(amp); amp.connect(p);
  const dry = ctx.createGain(); dry.gain.value = 1 - far * 0.75; p.connect(dry); dry.connect(sfxGain);
  const wet = ctx.createGain(); wet.gain.value = 0.5 + far * 0.9; p.connect(wet); wet.connect(reverb);
  o.start(t); lfo.start(t); br.start(t, Math.random()); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05); br.stop(t + dur + 0.05);
}

const VOWEL = {
  ah: [[800, 6, 1], [1200, 7, 0.6], [2600, 9, 0.25]],
  ee: [[320, 6, 1], [2400, 9, 0.5], [3000, 10, 0.3]],
  oh: [[500, 6, 1], [850, 7, 0.55], [2400, 10, 0.15]],
  oo: [[330, 6, 1], [700, 7, 0.35], [2300, 10, 0.08]],
  uh: [[600, 6, 1], [1000, 7, 0.5], [2400, 10, 0.12]],
};
const rp = () => (Math.random() * 2 - 1) * 0.9;
const rr = (a, b) => a + Math.random() * (b - a);

/** A burst of filtered noise routed through a panner (for cracks, clanks and thuds). */
function hit(t, dur, type, freq, q, peak, pan, far) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.002, peak, dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  src.connect(f); f.connect(g); g.connect(p);
  const dry = ctx.createGain(); dry.gain.value = 1 - far * 0.7; p.connect(dry); dry.connect(sfxGain);
  const wet = ctx.createGain(); wet.gain.value = 0.4 + far; p.connect(wet); wet.connect(reverb);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

export const horror = {
  scream(t, far = 0.6, loud = 1) { // a woman's scream, cracking at the top
    const f = rr(620, 900);
    voice(t, { contour: [f * 0.7, f * 1.25, f * 1.4, f * 1.3, f * 1.15, f * 0.9, f * 0.6], dur: rr(1.2, 2.4), formants: VOWEL.ah, vib: 7, vibDepth: 0.035, jitter: 0.08, breath: 0.3, gain: 0.22 * loud, pan: rp(), far });
  },
  agony(t, far = 0.6, loud = 1) { // a man crying out in pain
    const f = rr(150, 210);
    voice(t, { contour: [f, f * 1.6, f * 1.8, f * 1.5, f * 1.2, f * 0.8], dur: rr(1.4, 2.6), formants: VOWEL.oh, vib: 6, vibDepth: 0.04, jitter: 0.1, breath: 0.25, gain: 0.3 * loud, pan: rp(), far });
  },
  howl(t, far = 0.7, loud = 1) { // long rising howl, sometimes answered by a second one
    const f = rr(260, 340), pan = rp();
    voice(t, { contour: [f, f * 1.5, f * 1.9, f * 1.95, f * 1.9, f * 1.6, f * 1.1], dur: rr(3, 4.2), formants: VOWEL.oo, type: 'triangle', vib: 5, vibDepth: 0.015, jitter: 0.02, breath: 0.08, gain: 0.3 * loud, pan, far });
    if (Math.random() < 0.6) { const g = f * rr(0.8, 1.2); voice(t + rr(1, 2.2), { contour: [g, g * 1.6, g * 2, g * 1.9, g * 1.3], dur: rr(2.5, 3.5), formants: VOWEL.oo, type: 'triangle', vib: 5.5, vibDepth: 0.015, breath: 0.08, gain: 0.22 * loud, pan: -pan, far: Math.min(1, far + 0.2) }); }
  },
  moans(t, far = 0.7, loud = 1) { // a chorus of the damned groaning
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const f = rr(85, 150); voice(t + rr(0, 1.2), { contour: [f, f * 1.15, f * 0.95, f * 1.1, f * 0.8], dur: rr(3, 5), formants: Math.random() < 0.5 ? VOWEL.oh : VOWEL.oo, vib: 3, vibDepth: 0.03, jitter: 0.06, breath: 0.2, gain: 0.2 * loud, pan: rp(), far }); }
  },
  wail(t, far = 0.6, loud = 1) { // a long high lament
    const f = rr(420, 560);
    voice(t, { contour: [f, f * 1.3, f * 1.2, f * 1.35, f * 1.1, f * 1.2, f * 0.8], dur: rr(3, 4.5), formants: VOWEL.ee, vib: 6, vibDepth: 0.03, jitter: 0.04, breath: 0.2, gain: 0.16 * loud, pan: rp(), far });
  },
  sobbing(t, far = 0.5, loud = 1) {
    const pan = rp(), n = 4 + Math.floor(Math.random() * 4); let s = t;
    for (let i = 0; i < n; i++) { const f = rr(280, 360); voice(s, { contour: [f * 1.2, f, f * 0.75], dur: rr(0.25, 0.5), formants: VOWEL.uh, vib: 8, vibDepth: 0.04, jitter: 0.1, breath: 0.45, gain: 0.16 * loud, pan, far }); s += rr(0.35, 0.8); }
  },
  whipping(t, far = 0.5, loud = 1) { // lashes, each answered by a cry
    const pan = rp(), n = 2 + Math.floor(Math.random() * 3); let s = t;
    for (let i = 0; i < n; i++) {
      hit(s, 0.03, 'highpass', 2200, 0.7, 1.1 * loud, pan, far); hit(s + 0.01, 0.12, 'bandpass', 1400, 1.5, 0.4 * loud, pan, far);
      const f = rr(500, 800); voice(s + 0.1, { contour: [f, f * 1.4, f * 1.1, f * 0.7], dur: rr(0.5, 0.9), formants: VOWEL.ah, vib: 8, vibDepth: 0.04, jitter: 0.1, breath: 0.3, gain: 0.2 * loud, pan, far });
      s += rr(1.1, 1.8);
    }
  },
  chains(t, far = 0.5, loud = 1) {
    const pan = rp(), n = 6 + Math.floor(Math.random() * 10); let s = t;
    for (let i = 0; i < n; i++) { hit(s, rr(0.03, 0.08), 'bandpass', rr(2500, 6500), 9, rr(0.25, 0.6) * loud, pan, far); s += rr(0.03, 0.18); }
    hit(t + rr(0.2, 0.6), 0.25, 'lowpass', 300, 1, 0.5 * loud, pan, far);
  },
  slam(t, far = 0.8, loud = 1) { // an iron door or something heavy dropped, far away
    const pan = rp();
    hit(t, 0.9, 'lowpass', 220, 0.8, 1.3 * loud, pan, far); hit(t, 0.12, 'bandpass', 900, 2, 0.5 * loud, pan, far);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8); env(g, t, 0.004, 0.7 * loud, 0.8); o.connect(g); g.connect(reverb); o.start(t); o.stop(t + 1);
  },
  whisper(t, loud = 1) { // close, breathy, right by your ear
    const side = Math.random() < 0.5 ? -1 : 1, n = 3 + Math.floor(Math.random() * 4); let s = t;
    for (let i = 0; i < n; i++) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(rr(600, 1100), s); f1.frequency.linearRampToValueAtTime(rr(1200, 2600), s + 0.3);
      const g = ctx.createGain(); env(g, s, 0.05, 0.35 * loud, rr(0.2, 0.4));
      const p = ctx.createStereoPanner(); p.pan.value = side * 0.95;
      src.connect(f1); f1.connect(g); g.connect(p); p.connect(sfxGain);
      src.start(s, Math.random()); src.stop(s + 0.6); s += rr(0.25, 0.5);
    }
  },
};

/** What can be heard at each depth: [event, weight, earliest depth]. */
const EVENTS = [['slam', 3, 1], ['chains', 3, 1], ['moans', 2, 1], ['scream', 2, 2], ['agony', 2, 2], ['howl', 2, 2], ['sobbing', 1, 3], ['wail', 2, 4], ['whipping', 3, 5], ['whisper', 2, 6]];
let ambT = 6, bed = null;

/** Called every frame while playing. dread 0..1 grows with depth; more, louder and closer sounds as you go down. */
export function ambience(dt, depth) {
  if (!ctx || ctx.state !== 'running') return;
  ambT -= dt;
  if (ambT > 0) return;
  const dread = Math.min(1, (depth - 1) / 9);
  ambT = rr(0.6, 1.4) * (16 - dread * 12.5);
  const pool = EVENTS.filter(e => depth >= e[2]);
  let r = Math.random() * pool.reduce((s, e) => s + e[1], 0), ev = pool[0][0];
  for (const e of pool) { r -= e[1]; if (r <= 0) { ev = e[0]; break; } }
  const far = Math.max(0.15, rr(0.5, 0.95) - dread * 0.45), loud = 0.55 + dread * 0.6;
  const t = ctx.currentTime + 0.05;
  if (ev === 'whisper') horror.whisper(t, 0.5 + dread * 0.5); else horror[ev](t, far, loud);
}

/** A low wind-and-rumble bed under the music that thickens with depth. */
function startBed(depth) {
  stopBed();
  const dread = Math.min(1, (depth - 1) / 9);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260 + dread * 200; lp.Q.value = 3;
  const g = ctx.createGain(); g.gain.value = 0.07 + dread * 0.14;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency);
  const sub = ctx.createOscillator(), sg = ctx.createGain(); sub.frequency.value = 36 - dread * 6; sg.gain.value = dread * 0.12;
  src.connect(lp); lp.connect(g); g.connect(sfxGain); sub.connect(sg); sg.connect(sfxGain);
  src.start(); lfo.start(); sub.start();
  bed = { src, lfo, sub };
  ambT = rr(3, 7);
}
function stopBed() { if (!bed) return; try { bed.src.stop(); bed.lfo.stop(); bed.sub.stop(); } catch {} bed = null; }

/** Dark synth-wave loop: drone bass, arpeggio and hats, tempo rises with intensity. Turns dissonant in the Pit. */
export function startMusic(depth) {
  stopMusic();
  if (!ctx) return;
  startBed(depth);
  const roots = [55, 49, 58.27, 43.65, 51.91];
  const root = roots[(depth - 1) % roots.length];
  const scale = depth >= 7 ? [0, 1, 6, 1, 12, 13, 6, 0] : [0, 3, 7, 10, 12, 15, 7, 3];
  const bpm = 96 + Math.min(depth, 8) * 4, beat = 60 / bpm / 2;
  let step = 0, next = ctx.currentTime + 0.1;
  const drone = ctx.createOscillator(), dg = ctx.createGain(), df = ctx.createBiquadFilter();
  drone.type = 'sawtooth'; drone.frequency.value = root; df.type = 'lowpass'; df.frequency.value = 180; dg.gain.value = 0.22;
  drone.connect(df); df.connect(dg); dg.connect(musicGain); drone.start();
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 120; lfo.connect(lg); lg.connect(df.frequency); lfo.start();
  const tick = () => {
    while (next < ctx.currentTime + 0.2) {
      const t = next;
      if (step % 2 === 0) { // arp
        const n = scale[(step / 2) % scale.length], o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'square'; o.frequency.value = root * 4 * 2 ** (n / 12); f.type = 'lowpass'; f.frequency.value = 1400 + Math.sin(step / 16) * 900;
        env(g, t, 0.005, 0.07, 0.22); o.connect(f); f.connect(g); g.connect(musicGain); g.connect(reverb); o.start(t); o.stop(t + 0.3);
      }
      if (step % 8 === 0) { // kick
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
        env(g, t, 0.002, 0.55, 0.25); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.3);
      }
      if (step % 4 === 2) { // hat
        const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
        env(g, t, 0.001, 0.06, 0.05); s.connect(f); f.connect(g); g.connect(musicGain); s.start(t, Math.random()); s.stop(t + 0.08);
      }
      next += beat; step++;
    }
  };
  musicTimer = { id: setInterval(tick, 50), drone, lfo };
}

export function stopMusic() {
  stopBed();
  if (!musicTimer) return;
  clearInterval(musicTimer.id);
  try { musicTimer.drone.stop(); musicTimer.lfo.stop(); } catch {}
  musicTimer = null;
}
