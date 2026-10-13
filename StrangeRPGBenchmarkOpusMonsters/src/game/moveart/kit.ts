// The drawing and timing pieces every per-kind picture in this folder may use. Each part file keeps its own helpers, so
// two parts never edit the same file. Nothing here may run at module load, because battlefx.ts imports the part files.
export { dither, fadedScene, poseOf, tonesOf, colorOf, fxPx as px, fxLine as line, fxHashN as hash, fxEase as ease, fxStamp as stamp, fxShape as shapeAt, fxBeam as beamAt, fxImpact as impactAt, type FxRun, type FxPoint, type Tones } from '../battlefx';
export { clamp, prog, hold, hitOf, leaveOf, aim, selfish, shake, userAt, high, beside, oval, arc, blit, wash, bands, thick, sagAt, glint, waterDome, type Pt, type LegendArt } from '../legendfx';
export type { SceneLight } from '../backdrops';
