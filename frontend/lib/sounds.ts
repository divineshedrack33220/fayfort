/**
 * Tiny Web Audio sound kit for the portal.
 *
 * Everything is synthesized (no asset files, no permission prompts): a
 * telephone-style ring loop for inbound and outbound calls, a connected
 * chime, and a quiet blip for new messages and notifications. The AudioContext
 * is created lazily and unlocked by the first user gesture anywhere in the
 * app, so a ring that arrives through a WebSocket frame still plays.
 */

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const unlock = () => void context();
  for (const event of ["pointerdown", "keydown", "touchstart"] as const) {
    window.addEventListener(event, unlock, { once: true });
  }
}

function playTone(freq: number, startIn: number, duration: number, volume: number): void {
  const c = context();
  if (!c) return;
  const start = c.currentTime + startIn;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.02);
  gain.gain.setValueAtTime(volume, start + Math.max(0, duration - 0.06));
  gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

let ringVersion = 0;
let ringTimer: number | null = null;

/** Begins the telephone-style ring loop. Call stopRing() to silence it. */
export function startRing(variant: "incoming" | "outgoing" = "incoming"): void {
  const c = context();
  if (!c) return;
  const version = ++ringVersion;
  const tone = variant === "incoming" ? 520 : 440;
  const volume = variant === "incoming" ? 0.26 : 0.1;
  const cycle = () => {
    if (version !== ringVersion) return;
    playTone(tone, 0, 0.55, volume);
    playTone(tone, 0.85, 0.55, volume);
    ringTimer = window.setTimeout(cycle, 1800);
  };
  cycle();
}

/** Stops any in-flight ring loop. */
export function stopRing(): void {
  ringVersion += 1;
  if (ringTimer !== null) {
    window.clearTimeout(ringTimer);
    ringTimer = null;
  }
}

/** Short ascending chime once a call connects. */
export function playConnected(): void {
  playTone(523.25, 0, 0.16, 0.2);
  playTone(659.25, 0.16, 0.16, 0.2);
  playTone(783.99, 0.32, 0.3, 0.22);
}

/** Quiet two-note blip for new messages and notifications. */
export function playNotificationBlip(): void {
  playTone(880, 0, 0.09, 0.14);
  playTone(1318.51, 0.12, 0.2, 0.14);
}