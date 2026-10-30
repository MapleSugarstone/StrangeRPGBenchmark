// Design pitches for the companions: the current look first, then three alternatives each. Not used in play.
import { C } from '../engine/palette';
import type { Look } from './people';
import { LOOKS } from './cast';

export const PITCHES: { who: string; designs: { name: string; look: Look | string }[] }[] = [
  { who: 'Sallis', designs: [
    { name: 'Now', look: 'sallis' },
    { name: 'Flight jacket', look: { skin: C.skin1, hair: C.black, coat: C.mud1, accent: C.amb3, shirt: C.steel3, top: 'bomber', hairStyle: 'bald', extras: ['goggles'] } },
    { name: 'Logistics', look: { skin: C.skin1, hair: C.black, coat: C.steel1, accent: C.amb3, shirt: C.amb2, top: 'yoke', hairStyle: 'buzz', extras: ['collar'] } },
    { name: 'Night pilot', look: { skin: C.skin1, hair: C.black, coat: C.night, accent: C.grn3, shirt: C.grn2, top: 'collar', hairStyle: 'buzz', extras: ['goggles'] } },
  ] },
  { who: 'Quaye', designs: [
    { name: 'Now', look: 'quaye' },
    { name: 'Laundromat', look: { skin: C.skin1, hair: C.pale, coat: C.vio1, accent: C.cyan3, shirt: C.pale, top: 'vest', hairStyle: 'bun', extras: ['glasses', 'bag'], build: 'small' } },
    { name: 'Headscarf', look: { skin: C.skin1, hair: C.pale, coat: C.steel1, accent: C.mag2, shirt: C.white, top: 'lapel', hairStyle: 'short', extras: ['scarfhead', 'glasses'], build: 'small' } },
    { name: 'Old engineer', look: { skin: C.skin1, hair: C.white, coat: C.slate, accent: C.cyan3, shirt: C.steel3, top: 'harness', hairStyle: 'short', extras: ['glasses', 'port'], build: 'small' } },
  ] },
  { who: 'Ambrose', designs: [
    { name: 'Now', look: 'ambrose' },
    { name: 'Fighter', look: { skin: C.skin1, hair: C.black, coat: C.slate, accent: C.cyan3, shirt: C.amb2, top: 'open', hairStyle: 'bald', extras: ['gloves', 'eyeglow', 'beard'], build: 'broad' } },
    { name: 'Gentleman', look: { skin: C.skin1, hair: C.black, coat: C.vio1, accent: C.cyan3, shirt: C.white, top: 'lapel', hairStyle: 'bald', extras: ['gloves', 'eyeglow', 'beard'], build: 'broad' } },
    { name: 'Fight robe', look: { skin: C.skin1, hair: C.black, coat: C.mag1, accent: C.amb3, shirt: C.pale, top: 'trench', hairStyle: 'bald', extras: ['gloves', 'eyeglow', 'beard'], build: 'broad' } },
  ] },
  { who: 'Tova', designs: [
    { name: 'Now', look: 'tova' },
    { name: 'Club hood', look: { skin: C.skin2, hair: C.black, coat: C.cyan1, accent: C.grn3, shirt: C.grn2, top: 'hoodie', hairStyle: 'braids', extras: ['gloves'], build: 'slim' } },
    { name: 'Night out', look: { skin: C.skin2, hair: C.mag2, coat: C.night, accent: C.cyan3, shirt: C.mag2, top: 'bomber', hairStyle: 'tails', extras: ['gloves'], build: 'slim' } },
    { name: 'Witch', look: { skin: C.skin2, hair: C.black, coat: C.vio1, accent: C.grn3, shirt: C.pale, top: 'collar', hairStyle: 'long', extras: ['gloves'], build: 'slim' } },
  ] },
  { who: 'Ignace', designs: [
    { name: 'Now', look: 'ignace' },
    { name: 'Deacon robes', look: { skin: C.skin4, hair: C.mud1, coat: C.pale, accent: C.amb3, shirt: C.amb2, top: 'sash', hairStyle: 'short', extras: ['robe'], build: 'slim' } },
    { name: 'Street preacher', look: { skin: C.skin4, hair: C.mud1, coat: C.night, accent: C.amb3, shirt: C.white, top: 'lapel', hairStyle: 'swoop', extras: ['robe', 'zucchetto'], build: 'slim' } },
    { name: 'Off duty', look: { skin: C.skin4, hair: C.mud1, coat: C.vio2, accent: C.amb3, shirt: C.amb2, top: 'open', hairStyle: 'sidecut', extras: ['glasses'], build: 'slim' } },
  ] },
];
export { LOOKS };
