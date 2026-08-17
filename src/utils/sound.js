// src/utils/sound.js
// Small procedural sound effects generated with the Web Audio API.
// No external/copyrighted audio assets are used or required.

let ctx = null;
let enabled = true;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
}

export function setSoundEnabled(value) {
  enabled = value;
}

export function isSoundEnabled() {
  return enabled;
}

function tone(freq, duration, type = 'sine', gainPeak = 0.08, delay = 0) {
  if (!enabled) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const startTime = audio.currentTime + delay;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export const sounds = {
  play() {
    tone(520, 0.12, 'triangle', 0.06);
  },
  exchange() {
    tone(340, 0.09, 'square', 0.04);
    tone(420, 0.1, 'square', 0.04, 0.06);
  },
  draw() {
    tone(300, 0.08, 'sine', 0.05);
  },
  showCorrect() {
    tone(523, 0.14, 'triangle', 0.08);
    tone(659, 0.14, 'triangle', 0.08, 0.12);
    tone(784, 0.22, 'triangle', 0.09, 0.24);
  },
  showWrong() {
    tone(220, 0.25, 'sawtooth', 0.07);
    tone(160, 0.32, 'sawtooth', 0.07, 0.14);
  },
  eliminated() {
    tone(200, 0.3, 'sawtooth', 0.06);
    tone(140, 0.35, 'sawtooth', 0.06, 0.18);
  },
  victory() {
    tone(523, 0.16, 'triangle', 0.09);
    tone(659, 0.16, 'triangle', 0.09, 0.14);
    tone(784, 0.16, 'triangle', 0.09, 0.28);
    tone(1047, 0.32, 'triangle', 0.1, 0.42);
  },
  click() {
    tone(700, 0.04, 'square', 0.03);
  },
};
