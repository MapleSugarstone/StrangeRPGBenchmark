// Colors. Each area follows the bible's palette direction. Pure data.

export const UI = {
  ink: '#07060b', paper: '#efe6cf', dim: '#8a8270', faint: '#2a2440', gold: '#f0cc6c', red: '#e0483c',
  blue: '#5a84ff', white: '#ffffff', green: '#40d868', panel: '#141022', edge: '#4e4466', violet: '#a070e0',
};

/** Layer colors on enemy bars and held-concept icons. */
export const LAYER_COLOR = { shell: '#c8963c', memory: '#5a84ff', emotion: '#e0483c', name: '#efe6cf' } as const;

/** Tone colors for the Fractured Mind choice labels. */
export const TONE_COLOR: Record<string, string> = {
  Direct: '#efe6cf', Metaphorical: '#64c8b0', Fragmented: '#f4a850', Scientific: '#9cc0d8', Bureaucratic: '#e8c838', Existential: '#c4a0e4',
};

export const BRASS = {
  sky0: '#1e0f28', sky1: '#4a1f44', sky2: '#8c3a44', sky3: '#d8683c', sky4: '#f4a850', sky5: '#f8d890', cloud: '#fbe8c0',
  dark: '#2e1c10', brown: '#5a3818', brass: '#8a6430', gold: '#c8963c', shine: '#f0cc6c', steam: '#e8e4dc', verdigris: '#4a8a74', rust: '#a04a28',
  wood: '#6c4426', paper: '#e8d8b0', leaf: '#1c6c38',
};

export const SEA = {
  deep: '#0a0e2c', night: '#16204c', blue: '#244c84', teal: '#2c8494', foam: '#e0f4f0', seafoam: '#64c8b0', purple: '#7a50b0',
  lilac: '#c4a0e4', coral: '#e07088', sand: '#c8b890', mist: '#9cc0d8', ink: '#101830', paper: '#e4e0d0', lamp: '#f8e090',
};

export const STONE = {
  void: '#07060b', deep: '#160a28', blue: '#2830b8', cyan: '#48f0e4', magenta: '#f03cc4', acid: '#a8f040', white: '#ffffff',
  violet: '#6a2cc0', pale: '#c8f8f4', pink: '#ff98e0',
};

export const YEAR = {
  dark: '#241808', brown: '#5c3818', mustard: '#b08c1c', yellow: '#e8c838', pale: '#f4e08c', teeth: '#f0d860', green: '#40d868',
  dkgreen: '#1c6c38', orange: '#e8742c', red: '#b8382c', sky: '#f09848', meat: '#d86c6c', gray: '#8c8070',
};

export const VOID = { black: '#000000', ink: '#07060b', dim: '#1c1828', mid: '#3c3654', white: '#f4f0ff' };

/** The Pilgrim's outline color by the emotion it last absorbed. */
export const MOOD_COLOR: Record<string, string> = {
  none: '#dceeff', rage: '#e0483c', sorrow: '#5a84ff', fear: '#a070e0', joy: '#f4e08c', pride: '#f0cc6c', longing: '#64c8b0',
  confusion: '#f03cc4', despair: '#8a8270', misery: '#e8c838', dread: '#6a2cc0',
};
