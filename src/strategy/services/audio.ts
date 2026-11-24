// Procedural ambient score & UI sounds via WebAudio (no external audio assets).
import { useSettings } from './settings';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let timer: number | null = null;
const SCALE = [0, 3, 5, 7, 10, 12, 15]; // minor pentatonic-ish (D dorian flavour)

function ac(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}
function note(freq: number, start: number, dur: number, gain: number, type: OscillatorType, dest: AudioNode) {
  const c = ac();
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + Math.min(1.5, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(dest); o.start(start); o.stop(start + dur + 0.05);
}
export function startMusic(): void {
  const c = ac();
  if (c.state === 'suspended') void c.resume();
  if (timer !== null) return;
  musicGain = c.createGain();
  musicGain.gain.value = useSettings.getState().musicVolume * 0.25;
  const delay = c.createDelay(); delay.delayTime.value = 0.45;
  const fb = c.createGain(); fb.gain.value = 0.35;
  delay.connect(fb).connect(delay); delay.connect(musicGain);
  musicGain.connect(c.destination);
  const root = 146.83; // D3
  let bar = 0;
  const tick = () => {
    const t = c.currentTime + 0.05;
    const chordRoot = [0, -2, 3, -4][bar % 4];
    for (const iv of [0, 7, 12]) note(root * Math.pow(2, (chordRoot + iv - 12) / 12), t, 7.5, 0.18, 'sine', musicGain!);
    for (let i = 0; i < 4; i++) if (Math.random() < 0.65) note(root * Math.pow(2, (chordRoot + SCALE[Math.floor(Math.random() * SCALE.length)] + 12) / 12), t + i * 1.6 + Math.random() * 0.4, 2.6, 0.08, 'triangle', delay);
    bar++;
  };
  tick();
  timer = window.setInterval(tick, 6400);
}
export function stopMusic(): void {
  if (timer !== null) { clearInterval(timer); timer = null; }
  if (musicGain) { musicGain.disconnect(); musicGain = null; }
}
export function setMusicVolume(v: number): void { if (musicGain) musicGain.gain.value = v * 0.25; }
export function sfx(kind: 'click' | 'event' | 'war' | 'success'): void {
  const vol = useSettings.getState().sfxVolume;
  if (vol <= 0) return;
  try {
    const c = ac();
    const g = c.createGain(); g.gain.value = vol * 0.2; g.connect(c.destination);
    const t = c.currentTime;
    if (kind === 'click') note(880, t, 0.08, 0.3, 'triangle', g);
    if (kind === 'event') { note(523, t, 0.6, 0.3, 'sine', g); note(784, t + 0.12, 0.8, 0.25, 'sine', g); }
    if (kind === 'war') { note(110, t, 1.2, 0.5, 'sawtooth', g); note(98, t + 0.25, 1.2, 0.4, 'sawtooth', g); }
    if (kind === 'success') { note(659, t, 0.3, 0.3, 'triangle', g); note(880, t + 0.1, 0.5, 0.3, 'triangle', g); note(1319, t + 0.2, 0.7, 0.2, 'sine', g); }
  } catch { /* audio unavailable */ }
}
