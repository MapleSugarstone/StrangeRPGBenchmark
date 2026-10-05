import { CH1, CH2, CH3, CH4 } from './ch1to4';
import { CH5, CH6, CH7, CH8 } from './ch5to8';
import { CH9, CH10, CH11, CH12 } from './ch9to12';
import type { ChapterDef } from './types';

export const CHAPTERS: ChapterDef[] = [CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8, CH9, CH10, CH11, CH12];
export const chapter = (n: number): ChapterDef => CHAPTERS[n - 1];
