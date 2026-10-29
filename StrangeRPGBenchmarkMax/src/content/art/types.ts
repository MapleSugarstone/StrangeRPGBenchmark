// Art data formats. Rows are strings: '.' clear, '1' '2' '3' the three color slots.

export type Pal = readonly [number, number, number];
export type Rows = readonly string[];

/** A walking character: two frames each facing down, up, and right. Left mirrors right. 8 by 8. */
export interface CharArt { pal: Pal; down: readonly [Rows, Rows]; up: readonly [Rows, Rows]; side: readonly [Rows, Rows]; }

/** A foe: idle frames that loop (a wiggle), and an optional attack frame. 8 by 8, or 16 by 16 for big foes. */
export interface MonArt { pal: Pal; idle: readonly Rows[]; act?: Rows; }

/** A floor or wall tile, 8 by 8. More than one frame animates it. */
export interface TileArt { pal: Pal; frames: readonly Rows[]; }

/** A prop drawn over tiles: 8 by 8, or 8 wide and 16 tall when tall. Props can cast leads. */
export interface PropArt { pal: Pal; rows: Rows; tall?: boolean; frames?: readonly Rows[] }

/** A small interface icon, 8 by 8 or smaller. */
export interface IconArt { pal: Pal; rows: Rows }
