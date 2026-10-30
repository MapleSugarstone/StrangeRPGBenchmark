// Gigs from the two fixers, Opal (the Deeps) and Kat (the Lantern Steps): journal entries and job items.
import { addQuests, type QuestDef } from './quests';
import { addItems } from '../rules/data';

addItems([
  { id: 'eelcooler', name: 'Cooler of Eels', kind: 'key', price: 0, desc: 'For Rook, from Opal. Heavy with eels. It clinks.' },
  { id: 'contract', name: 'Voicebox Lease', kind: 'key', price: 0, desc: 'Lease 220-N. One voicebox. Holder: P. Mevius. User: Nienke.' },
]);

const OPAL: [string, string] = ['camp', 'opal_stall'];
const KAT: [string, string] = ['steps', 'kat_spot'];

function gig(id: string, title: string, xp: number, goal: string, where: [string, string], fixer: 'Opal' | 'Kat'): QuestDef {
  return {
    id, title, kind: 'gig', xp,
    stages: {
      '1': goal,
      '2': fixer === 'Opal' ? 'Done. Tell Opal at her slate on the Clement.' : 'Done. Tell Kat at her booth outside Club Violet.',
      done: 'Paid.',
    },
    where: { '1': where, '2': fixer === 'Opal' ? OPAL : KAT },
  };
}

addQuests([
  gig('gig_crates', 'Forty Crates', 150, 'Forty crates of Board Hush sit on the dock at the pump depot on Canal Six. Get them into the canal before Recovery collects them. Ask Opal for Gus\'s boat.', ['depot', 'crates'], 'Opal'),
  gig('gig_eels', 'Eel Run', 120, 'Take Opal\'s cooler of eels to Rook on his houseboat off Canal Four. Opal said not to open it.', ['houseboat', 'deck'], 'Opal'),
  gig('gig_painter', 'The Painter', 150, 'Saar the Bailer painter is locked in the pump depot\'s office cell for painting on Hendrik\'s knee. Get her out.', ['depot', 'office_door'], 'Opal'),
  gig('gig_voice', 'Her Voice', 150, 'Mevius, the manager of Club Violet, holds the lease on Nienke\'s voicebox and switches it off when she sings elsewhere. Get the lease to Nienke.', ['violet', 'office_front'], 'Kat'),
  gig('gig_relay', 'Blind Spot', 150, 'Blind Board Relay 4 on the roof above Terrace 3 until morning, so a family can walk down the east stairs uncounted. Kat can send you up the service ladder.', ['rooftop', 'relay_front'], 'Kat'),
  gig('gig_test', 'Clean Test', 180, 'Mia Dekker, six, tested positive at the Census van on Terrace 4 this afternoon. Make her result read negative before it goes up at six bells.', ['terraces', 'van_back'], 'Kat'),
  gig('gig_driver', 'Sunday', 200, 'Hugo, a Board driver, waits on the loading dock behind Mercy Spire. Get him out through the car park gate without the Board noticing.', ['spirebase', 'bay'], 'Kat'),
  gig('gig_repo', 'Breathe', 150, 'Bodywell\'s repo crew is coming for Opa Kok\'s left lung on Terrace 1 tonight. Stop them.', ['terraces', 'kok_front'], 'Kat'),
  gig('gig_book', 'Drowned Book', 200, 'Mevrouw Vis\'s houseboat broke loose in the flood with her debt book aboard. Half of Canal Four is written in it. Sink it.', ['houseboat', 'cabin_door'], 'Opal'),
  gig('gig_motors', 'Ninety Kilos', 200, 'Two Board sump motors sit in the flooded pump depot, and Cutter salvagers are on them. Get the motors, for Opal\'s buyer or for Quaye.', ['depot', 'motors'], 'Opal'),
]);
