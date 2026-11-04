/**
 * A sprite is an 8x8 grid of characters.
 * '.' is transparent.
 * '1', '2', '3' pick from the colors array (1-3 colors max).
 */
export interface Sprite {
  rows: string[];
  colors: string[];
  name?: string;
  data?: string;
}
