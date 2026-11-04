// Qwen's own music for Ruin, copied unchanged from its first engine (Notes/qwen/20261102-124352-agent-036-music).
// Each track is one 16-step pattern; src/audio/toybox.ts plays it on its own instruments.
export type QwenVoice = "square" | "triangle" | "sawtooth" | "sine" | "noise";
export interface QwenNote { time: number; freq?: number; dur?: number; vol?: number; type?: QwenVoice; detune?: number }
export interface QwenTrack { name: string; patterns: { notes: QwenNote[] }[]; order: number[]; tempo: number }

const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.00;
const A4 = 440.00;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const D4 = 293.66;
const F4 = 349.23;
const F5 = 698.46;
const A5 = 880.00;
const B3 = 246.94;
const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.00;
const A3 = 220.00;
const D5 = 587.33;
const B4 = 493.88;

export const QWEN_TRACKS: Record<string, QwenTrack> = {
  "title": {
    name: "Title Screen",
    tempo: 90,
    patterns: [
      {
        notes: [
          { time: 0, freq: C4, dur: 0.2, vol: 0.1, type: "square" },
          { time: 4, freq: E4, dur: 0.2, vol: 0.1, type: "square" },
          { time: 8, freq: G4, dur: 0.2, vol: 0.1, type: "square" },
          { time: 12, freq: C5, dur: 0.4, vol: 0.1, type: "square" },
          { time: 0, freq: C3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 4, freq: G3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 8, freq: C3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 12, freq: G3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.05, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.05, type: "noise" },
        ]
      }
    ],
    order: [0]
  },
  "town": {
    name: "Town",
    tempo: 110,
    patterns: [
      {
        notes: [
          { time: 0, freq: D4, dur: 0.15, vol: 0.08, type: "square" },
          { time: 2, freq: F4, dur: 0.15, vol: 0.08, type: "square" },
          { time: 4, freq: A4, dur: 0.15, vol: 0.08, type: "square" },
          { time: 6, freq: D5, dur: 0.15, vol: 0.08, type: "square" },
          { time: 8, freq: F4, dur: 0.15, vol: 0.08, type: "square" },
          { time: 10, freq: A4, dur: 0.15, vol: 0.08, type: "square" },
          { time: 12, freq: D4, dur: 0.3, vol: 0.08, type: "square" },
          { time: 0, freq: D3, dur: 0.3, vol: 0.12, type: "triangle" },
          { time: 4, freq: A3, dur: 0.3, vol: 0.12, type: "triangle" },
          { time: 8, freq: D3, dur: 0.3, vol: 0.12, type: "triangle" },
          { time: 12, freq: A3, dur: 0.3, vol: 0.12, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 4, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 12, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
        ]
      }
    ],
    order: [0]
  },
  "route": {
    name: "Route",
    tempo: 130,
    patterns: [
      {
        notes: [
          { time: 0, freq: E4, dur: 0.1, vol: 0.08, type: "square" },
          { time: 2, freq: G4, dur: 0.1, vol: 0.08, type: "square" },
          { time: 4, freq: B4, dur: 0.1, vol: 0.08, type: "square" },
          { time: 6, freq: E5, dur: 0.1, vol: 0.08, type: "square" },
          { time: 8, freq: G4, dur: 0.1, vol: 0.08, type: "square" },
          { time: 10, freq: B4, dur: 0.1, vol: 0.08, type: "square" },
          { time: 12, freq: E4, dur: 0.2, vol: 0.08, type: "square" },
          { time: 0, freq: E3, dur: 0.2, vol: 0.12, type: "triangle" },
          { time: 4, freq: B3, dur: 0.2, vol: 0.12, type: "triangle" },
          { time: 8, freq: E3, dur: 0.2, vol: 0.12, type: "triangle" },
          { time: 12, freq: B3, dur: 0.2, vol: 0.12, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 4, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
          { time: 12, freq: 0, dur: 0.1, vol: 0.04, type: "noise" },
        ]
      }
    ],
    order: [0]
  },
  "battle": {
    name: "Battle",
    tempo: 140,
    patterns: [
      {
        notes: [
          { time: 0, freq: A4, dur: 0.1, vol: 0.1, type: "square" },
          { time: 2, freq: C5, dur: 0.1, vol: 0.1, type: "square" },
          { time: 4, freq: E5, dur: 0.1, vol: 0.1, type: "square" },
          { time: 6, freq: A5, dur: 0.1, vol: 0.1, type: "square" },
          { time: 8, freq: C5, dur: 0.1, vol: 0.1, type: "square" },
          { time: 10, freq: E5, dur: 0.1, vol: 0.1, type: "square" },
          { time: 12, freq: A4, dur: 0.2, vol: 0.1, type: "square" },
          { time: 0, freq: A3, dur: 0.2, vol: 0.15, type: "triangle" },
          { time: 4, freq: E4, dur: 0.2, vol: 0.15, type: "triangle" },
          { time: 8, freq: A3, dur: 0.2, vol: 0.15, type: "triangle" },
          { time: 12, freq: E4, dur: 0.2, vol: 0.15, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.06, type: "noise" },
          { time: 4, freq: 0, dur: 0.1, vol: 0.06, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.06, type: "noise" },
          { time: 12, freq: 0, dur: 0.1, vol: 0.06, type: "noise" },
        ]
      }
    ],
    order: [0]
  },
  "keeper": {
    name: "Keeper Battle",
    tempo: 150,
    patterns: [
      {
        notes: [
          { time: 0, freq: G4, dur: 0.1, vol: 0.12, type: "square" },
          { time: 2, freq: B4, dur: 0.1, vol: 0.12, type: "square" },
          { time: 4, freq: D5, dur: 0.1, vol: 0.12, type: "square" },
          { time: 6, freq: G5, dur: 0.1, vol: 0.12, type: "square" },
          { time: 8, freq: B4, dur: 0.1, vol: 0.12, type: "square" },
          { time: 10, freq: D5, dur: 0.1, vol: 0.12, type: "square" },
          { time: 12, freq: G4, dur: 0.2, vol: 0.12, type: "square" },
          { time: 0, freq: G3, dur: 0.2, vol: 0.18, type: "triangle" },
          { time: 4, freq: D4, dur: 0.2, vol: 0.18, type: "triangle" },
          { time: 8, freq: G3, dur: 0.2, vol: 0.18, type: "triangle" },
          { time: 12, freq: D4, dur: 0.2, vol: 0.18, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.08, type: "noise" },
          { time: 4, freq: 0, dur: 0.1, vol: 0.08, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.08, type: "noise" },
          { time: 12, freq: 0, dur: 0.1, vol: 0.08, type: "noise" },
        ]
      }
    ],
    order: [0]
  },
  "sad": {
    name: "Sad Scene",
    tempo: 70,
    patterns: [
      {
        notes: [
          { time: 0, freq: C4, dur: 0.4, vol: 0.1, type: "square" },
          { time: 4, freq: E4, dur: 0.4, vol: 0.1, type: "square" },
          { time: 8, freq: G4, dur: 0.4, vol: 0.1, type: "square" },
          { time: 12, freq: C5, dur: 0.4, vol: 0.1, type: "square" },
          { time: 0, freq: C3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 4, freq: G3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 8, freq: C3, dur: 0.4, vol: 0.15, type: "triangle" },
          { time: 12, freq: G3, dur: 0.4, vol: 0.15, type: "triangle" },
        ]
      }
    ],
    order: [0]
  },
  "ending": {
    name: "Ending",
    tempo: 100,
    patterns: [
      {
        notes: [
          { time: 0, freq: E4, dur: 0.3, vol: 0.12, type: "square" },
          { time: 4, freq: G4, dur: 0.3, vol: 0.12, type: "square" },
          { time: 8, freq: B4, dur: 0.3, vol: 0.12, type: "square" },
          { time: 12, freq: E5, dur: 0.3, vol: 0.12, type: "square" },
          { time: 0, freq: E3, dur: 0.3, vol: 0.18, type: "triangle" },
          { time: 4, freq: B3, dur: 0.3, vol: 0.18, type: "triangle" },
          { time: 8, freq: E3, dur: 0.3, vol: 0.18, type: "triangle" },
          { time: 12, freq: B3, dur: 0.3, vol: 0.18, type: "triangle" },
          { time: 0, freq: 0, dur: 0.1, vol: 0.05, type: "noise" },
          { time: 8, freq: 0, dur: 0.1, vol: 0.05, type: "noise" },
        ]
      }
    ],
    order: [0]
  }
};
