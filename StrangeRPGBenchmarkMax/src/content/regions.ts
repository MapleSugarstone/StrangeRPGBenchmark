// Light for each region. The sun never moves, so each region has one fixed sun and one shade color.
import type { RGB } from '../engine/light';
import { SHADES, type ShadeRamp } from '../engine/palette';

export interface Sun { dx: number; dy: number; z: number; intensity: number; color: number }

export interface Region {
  id: string;
  name: string;
  sun: Sun | null;
  /** Lead length per pixel of height, in the field. */
  lowness: number;
  /** Lead length per unit of height, in battle tiles. */
  battleLowness: number;
  /** The direction leads fall in battle, as a grid step. */
  dir8: [number, number];
  ambient: RGB;
  shade: ShadeRamp;
  /** Footstep material when a tile does not say. */
  step: string;
}

const gold = 0xffd890;

export const REGIONS: Record<string, Region> = {
  stile: { id: 'stile', name: 'Stile', sun: { dx: 1, dy: 0.18, z: 0.35, intensity: 0.75, color: gold }, lowness: 3, battleLowness: 3, dir8: [1, 0], ambient: [0.42, 0.34, 0.36], shade: SHADES.plum, step: 'stone' },
  road: { id: 'road', name: 'The Long', sun: { dx: 1, dy: 0.18, z: 0.35, intensity: 0.78, color: gold }, lowness: 3, battleLowness: 3, dir8: [1, 0], ambient: [0.44, 0.36, 0.36], shade: SHADES.plum, step: 'grass' },
  market: { id: 'market', name: 'The Lead Market', sun: { dx: 1, dy: 0.2, z: 0.4, intensity: 0.7, color: gold }, lowness: 3, battleLowness: 3, dir8: [1, 0], ambient: [0.44, 0.36, 0.34], shade: SHADES.plum, step: 'stone' },
  bright: { id: 'bright', name: 'The Bright', sun: { dx: 0, dy: -1, z: 2.2, intensity: 0.85, color: 0xfff6e0 }, lowness: 1, battleLowness: 1, dir8: [0, -1], ambient: [0.55, 0.55, 0.52], shade: SHADES.teal, step: 'sand' },
  glass: { id: 'glass', name: 'The Glass', sun: { dx: -0.4, dy: -1, z: 3.5, intensity: 0.85, color: 0xf0fff4 }, lowness: 0.5, battleLowness: 1, dir8: [0, -1], ambient: [0.55, 0.6, 0.58], shade: SHADES.green, step: 'glass' },
  overhead: { id: 'overhead', name: 'Overhead', sun: { dx: 0, dy: 0, z: 9, intensity: 0.95, color: 0xfff0f4 }, lowness: 0, battleLowness: 0, dir8: [0, 0], ambient: [0.6, 0.56, 0.58], shade: SHADES.ink, step: 'stone' },
  dusk: { id: 'dusk', name: 'The Long', sun: { dx: 1, dy: 0.12, z: 0.18, intensity: 0.6, color: 0xff9a6a }, lowness: 5, battleLowness: 3, dir8: [1, 0], ambient: [0.22, 0.16, 0.24], shade: SHADES.violet, step: 'grass' },
  back: { id: 'back', name: 'The Back', sun: null, lowness: 0, battleLowness: 0, dir8: [0, 0], ambient: [0.02, 0.02, 0.05], shade: SHADES.blue, step: 'dirt' },
  stile7: { id: 'stile7', name: 'Stile', sun: { dx: 1, dy: 0.18, z: 0.35, intensity: 0.6, color: gold }, lowness: 3, battleLowness: 3, dir8: [1, 0], ambient: [0.3, 0.26, 0.36], shade: SHADES.violet, step: 'stone' },
  under: { id: 'under', name: 'Underbridge', sun: null, lowness: 0, battleLowness: 0, dir8: [0, 0], ambient: [0.62, 0.55, 0.6], shade: SHADES.plum, step: 'stone' },
  interior: { id: 'interior', name: 'Indoors', sun: null, lowness: 0, battleLowness: 0, dir8: [0, 0], ambient: [1.0, 0.9, 0.86], shade: SHADES.plum, step: 'wood' },
};
