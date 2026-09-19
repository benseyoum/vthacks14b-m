/**
 * A tiny ring buffer of motion energy shared between the camera and the trace
 * drawn across the page.
 *
 * The point: the waveform on screen is measured from the actual video, not a
 * looping animation. What you see moving is you moving.
 */

const SIZE = 240;

const buffer = new Float32Array(SIZE);

let writeIndex = 0;
let lastPush = 0;

export function pushSignalEnergy(energy: number) {
  buffer[writeIndex] = Math.min(1, Math.max(0, energy));
  writeIndex = (writeIndex + 1) % SIZE;
  lastPush = Date.now();
}

/** Oldest-to-newest copy of the buffer. */
export function readSignal(out: Float32Array) {
  for (let i = 0; i < SIZE; i++) {
    out[i] = buffer[(writeIndex + i) % SIZE];
  }

  return out;
}

export function signalIsLive() {
  return Date.now() - lastPush < 500;
}

export const SIGNAL_SIZE = SIZE;
