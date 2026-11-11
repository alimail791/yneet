// Original background music for the quiz Shorts, synthesised from scratch in
// code (no samples, no loops from anywhere else), so there's nothing that can
// get a copyright claim. A soft lo-fi groove that follows the video:
//   read      warm chords + light hi-hat
//   countdown tick-tock on every second, a rising note, the beat drops out
//   reveal    a bright chime and a cymbal swell
//   explain   full groove: chords, bass, kick, snare, hats
//   end card  last chord rings out
// Each subject gets its own key so the three daily videos don't sound the same.
import { writeFile } from "node:fs/promises";

const SR = 44100;
const BPM = 96;
const BEAT = 60 / BPM;
const BAR = 4 * BEAT;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// i–VI–III–VII (minor) or I–V–vi–IV (major) progressions, as MIDI chord roots + qualities.
const PROGRESSIONS = {
  Physics: { root: 57, chords: [[0, "m"], [-4, "M"], [3, "M"], [-2, "M"]] },   // A minor: Am F C G
  Chemistry: { root: 60, chords: [[0, "M"], [7, "M"], [9, "m"], [5, "M"]] },   // C major: C G Am F
  Biology: { root: 62, chords: [[0, "M"], [-5, "M"], [-3, "m"], [-7, "M"]] },  // D major: D A Bm G
};
const triad = (q) => (q === "m" ? [0, 3, 7] : [0, 4, 7]);

// Small deterministic noise so every render of the same video is identical.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1; }

export async function writeMusic(file, { subject = "Physics", timeline }) {
  const at = {}; let t0 = 0;
  for (const [k, v] of Object.entries(timeline)) { at[k] = t0; t0 += v; }
  const dur = t0;
  const n = Math.ceil(dur * SR);
  const out = new Float32Array(n);
  const prog = PROGRESSIONS[subject] || PROGRESSIONS.Physics;
  const noise = rng(subject.length * 7919);

  const add = (start, len, fn, gain = 1) => {
    const a = Math.max(0, Math.floor(start * SR)), b = Math.min(n, Math.floor((start + len) * SR));
    for (let i = a; i < b; i++) out[i] += gain * fn((i - a) / SR, i / SR);
  };
  const env = (t, atk, len, rel) => (t < atk ? t / atk : t > len - rel ? Math.max(0, (len - t) / rel) : 1);

  // Chords (pad): detuned soft tones, one chord per bar, quieter while reading and counting.
  const bars = Math.ceil(dur / BAR) + 1;
  for (let b = 0; b < bars; b++) {
    const start = b * BAR;
    const [off, q] = prog.chords[b % prog.chords.length];
    const notes = triad(q).map((x) => prog.root + off + x);
    const len = BAR + 0.15;
    for (const m of notes) {
      const f = midi(m);
      add(start, len, (t, abs) => {
        const sect = abs < at.countdown ? 1.0 : abs < at.reveal ? 0.55 : abs < at.cta ? 0.85 : 0.95;
        const s = Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t + 0.3);
        return sect * env(t, 0.25, len, 0.4) * s;
      }, 0.028);
    }
  }

  // Bass: root, plucked on beats 1 and 3 (from the reveal on), softer while reading.
  for (let b = 0; b < bars; b++) {
    const [off] = prog.chords[b % prog.chords.length];
    const f = midi(prog.root + off - 24);
    for (const beat of [0, 2]) {
      const start = b * BAR + beat * BEAT;
      if (start >= at.countdown && start < at.reveal) continue; // beat drops out for the countdown
      const g = start < at.countdown ? 0.11 : 0.12;
      add(start, BEAT * 1.6, (t) => Math.exp(-2.6 * t) * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 2 * f * t)), g);
    }
  }

  // Drums.
  const steps = Math.ceil(dur / (BEAT / 2));
  for (let s = 0; s < steps; s++) {
    const start = s * (BEAT / 2);
    if (start >= at.countdown && start < at.reveal) continue;
    const groove = start >= at.reveal && start < at.cta + 1;
    // hi-hat on every 8th
    add(start, 0.06, (t) => Math.exp(-70 * t) * noise(), groove ? 0.05 : 0.045);
    if (!groove) continue;
    const beatNo = s % 8; // 8 eighths per bar
    if (beatNo === 0 || beatNo === 4 || beatNo === 5) add(start, 0.32, (t) => Math.exp(-9 * t) * Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-28 * t)) * t), 0.34); // kick
    if (beatNo === 2 || beatNo === 6) add(start, 0.18, (t) => Math.exp(-22 * t) * (0.7 * noise() + 0.3 * Math.sin(2 * Math.PI * 190 * t)), 0.14); // snare
  }

  // Countdown: tick-tock each second + a slow rising note for tension.
  for (let k = 0; k < Math.round(timeline.countdown); k++) {
    const f = k % 2 ? 900 : 1250;
    add(at.countdown + k, 0.15, (t) => Math.exp(-55 * t) * Math.sin(2 * Math.PI * f * t), 0.38);
  }
  add(at.countdown, timeline.countdown, (t) => {
    const f = midi(prog.root + 12) * (1 + 0.12 * (t / timeline.countdown));
    return (t / timeline.countdown) * Math.sin(2 * Math.PI * f * t);
  }, 0.05);

  // Reveal: bright chime (chord tones) + a short cymbal swell.
  const [roff, rq] = prog.chords[0];
  triad(rq).concat([12]).forEach((x, k) => {
    const f = midi(prog.root + roff + 12 + x);
    add(at.reveal + k * 0.04, 2.2, (t) => Math.exp(-2.6 * t) * Math.sin(2 * Math.PI * f * t), 0.12);
  });
  add(at.reveal - 0.35, 1.4, (t) => (t < 0.35 ? t / 0.35 : Math.exp(-3 * (t - 0.35))) * noise(), 0.05);

  // Loudness: bring the whole mix to a typical Shorts level (~-14.5 dB RMS), with a
  // soft limiter so peaks don't clip, then keep the top at -1 dB.
  let sum = 0;
  for (let i = 0; i < n; i++) sum += out[i] * out[i];
  const rms = Math.sqrt(sum / n) || 1e-9;
  const gain = 10 ** (-14.5 / 20) / rms;
  let peak = 0;
  for (let i = 0; i < n; i++) { out[i] = Math.tanh(out[i] * gain); peak = Math.max(peak, Math.abs(out[i])); }
  const scale = peak > 0 ? Math.min(1, 0.89 / peak) : 1;
  const fadeOut = Math.floor(0.6 * SR);
  for (let i = 0; i < n; i++) {
    let v = out[i] * scale;
    if (i > n - fadeOut) v *= (n - i) / fadeOut;
    if (i < 0.05 * SR) v *= i / (0.05 * SR);
    out[i] = v;
  }

  // 16-bit mono WAV.
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
  await writeFile(file, buf);
  return file;
}
