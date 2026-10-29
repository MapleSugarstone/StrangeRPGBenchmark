// Every map in the game.
import { defineMaps } from '../../game/map';
import { CH1 } from './ch1';
import { CH2 } from './ch2';
import { CH3 } from './ch3';
import { CH4 } from './ch4';
import { CH5 } from './ch5';
import { CH6 } from './ch6';
import { CH7 } from './ch7';

export function loadMaps() {
  defineMaps([...CH1, ...CH2, ...CH3, ...CH4, ...CH5, ...CH6, ...CH7]);
}
