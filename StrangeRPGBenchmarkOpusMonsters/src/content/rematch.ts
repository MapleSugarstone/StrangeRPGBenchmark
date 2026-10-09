import { MAPS } from '../game/world';
import { makeMon } from '../data/species';
import type { Mon } from '../battle/model';
import { graftonTeam } from './ch4';

const team = (...kinds: string[]) => () => kinds.map(k => makeMon(k, 50));
function withN(kind: string, n: string): Mon { const m = makeMon(kind, 50); m.notion = n; return m; }

const R: [string, string, string, string, () => Mon[]][] = [
  ['ribgym', 'knuckle', 'rib', 'Knuckle', team('cairn', 'menhir', 'hare', 'tor')],
  ['mastgym', 'leeward', 'mast', 'Leeward', team('squall', 'coma', 'brine', 'bore')],
  ['spiregym', 'verger', 'spire', 'Verger', team('grotesque', 'siren', 'fogbank', 'flare')],
  ['bolegym', 'grafton', 'bole', 'Grafton', () => graftonTeam(50)],
  ['humgym', 'ohm', 'pylon', 'Ohm', () => [withN('turbine', 'longshin'), withN('piston', 'edgecharm'), withN('furnace', 'embercoat'), withN('perigee', 'bodkin')]],
  ['tuskgym', 'tallow', 'tusk', 'Old Amber', team('yoke', 'menhir', 'halo', 'floe')],
  ['hiltgym', 'quillon', 'hilt', 'Quillon', team('stoat', 'carrion', 'gore', 'hemlock')],
  ['fallgym', 'perihel', 'fall', 'Perihel', team('orrery', 'fulgur', 'dynamo', 'coma')],
];

for (const [map, id, scale, name, t] of R) {
  const n = MAPS[map]?.npcs.find(x => x.id === id);
  if (n) n.rematch = { scale, name, team: t };
}
