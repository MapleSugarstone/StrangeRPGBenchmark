export interface ShopDef { name: string; chapter: number; items: string[] }

export const SHOPS: Record<string, ShopDef> = {
  edgewick: { name: 'Edgewick Stores', chapter: 1, items: ['tallow', 'pin', 'ink_vial', 'pole1', 'wool_scarf'] },
  fizz: { name: 'Frog Radio Trading Post', chapter: 2, items: ['tallow', 'ink_vial', 'pin', 'relight', 'prism', 'pole2', 'claw1', 'claw2', 'brush1', 'blue_wick', 'mothball'] },
  prismouth: { name: 'Prismouth Paints', chapter: 2, items: ['tallow', 'candle', 'ink_vial', 'relight', 'prism', 'brush2', 'violet_bristle', 'claw2', 'pole2', 'lucky_button', 'ink_ring'] },
  carillon: { name: 'Reliquary Shop', chapter: 3, items: ['candle', 'ink_vial', 'relight', 'pin', 'prism', 'pole3', 'claw3', 'brush3', 'blade2', 'blade3', 'red_hook', 'cyan_edge', 'hue_lens', 'grey_ward'] },
  hourglass: { name: 'Sand Merchant', chapter: 4, items: ['candle', 'ink_vial', 'ink_well', 'relight', 'clock_tea', 'paint_bomb', 'pole4', 'claw4', 'brush4', 'blade4', 'hand3', 'hand4', 'green_hour', 'shell_pick', 'metronome'] },
  undermarket: { name: 'The Undermarket', chapter: 5, items: ['candle', 'honey', 'ink_well', 'relight', 'chorus', 'paint_bomb', 'clock_tea', 'pole5', 'claw5', 'brush5', 'blade5', 'hand5', 'slot4', 'slot5', 'amber_slot', 'piggy', 'feather', 'iron_rind'] },
  tether: { name: 'Sky Chandler', chapter: 6, items: ['honey', 'ink_well', 'relight', 'chorus', 'paint_bomb', 'pole5', 'claw5', 'brush5', 'blade5', 'hand5', 'slot5', 'glass4', 'glass5', 'red_pane', 'spool_charm', 'iron_rind'] },
  loom: { name: 'Spare Parts Bin', chapter: 7, items: ['honey', 'ink_well', 'relight', 'chorus', 'pole6', 'claw6', 'brush6', 'blade6', 'hand6', 'slot6', 'glass6', 'none5', 'none6', 'green_mask'] },
  grey: { name: 'Last Stall', chapter: 8, items: ['honey', 'ink_well', 'relight', 'chorus', 'paint_bomb', 'pole6', 'claw6', 'brush6', 'blade6', 'hand6', 'slot6', 'glass6', 'none6', 'grey_ward'] },
};
