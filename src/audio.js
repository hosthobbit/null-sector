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
  descend() { if (!ctx) return; const t = ctx.currentTime; tone(t, 'sine', 80, 400, 1.4, 0.5, 0.9); noise(t, 1.4, 'bandpass', 500, 1, 0.5, 0.9).frequency.exponentialRampToValueAtTime(5000, t + 1.3); },
};

/** Dark synth-wave loop: drone bass, arpeggio and hats, tempo rises with intensity. */
export function startMusic(depth) {
  stopMusic();
  if (!ctx) return;
  const roots = [55, 49, 58.27, 43.65, 51.91];
  const root = roots[(depth - 1) % roots.length];
  const scale = [0, 3, 7, 10, 12, 15, 7, 3];
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
  if (!musicTimer) return;
  clearInterval(musicTimer.id);
  try { musicTimer.drone.stop(); musicTimer.lfo.stop(); } catch {}
  musicTimer = null;
}
