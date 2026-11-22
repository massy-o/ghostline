// GHOSTLINE — Silent Floors. Shared tuning constants: the stage, the operative,
// the guards, and the noir palette the renderer paints with.

export const VIEW = { width: 960, height: 600 };
export const TILE = 30;
export const COLS = 32;
export const ROWS = 20;
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 10,
  walkSpeed: 138,
  sneakSpeed: 76,
  noiseRadius: 96,      // running feet carry this far
  lightRadius: 64,      // the small pool of light the operative carries
};

export const GUARD = {
  radius: 11,
  patrolSpeed: 62,
  investigateSpeed: 88,
  chaseSpeed: 148,
  fovHalfAngle: 0.62,   // radians, ~35.5 degrees each side
  viewRange: 178,
  hearRadius: 100,
  catchDistance: 17,
  loseSightAfter: 2.6,  // seconds of no contact before a chase gives up
  searchSeconds: 3.2,
};

export const DETECTION = {
  fillPerSecond: 1.15,  // at point blank in full light
  fillRangeFactor: 0.45, // extra slowness at the cone's rim
  shadowFactor: 0.38,   // hiding on shadow floor
  sneakFactor: 0.55,    // moving low and slow
  stillFactor: 0.7,     // holding perfectly still
  decayPerSecond: 0.32,
  suspectAt: 0.45,      // guard stops and stares
  alertAt: 1.0,         // guard gives chase
};

export const SCORE = {
  levelBase: 1000,
  intelBonus: 250,
  unseenBonus: 400,
  perSecond: -2,
  perSpotted: -150,
};

export const RANKS = [
  { min: 3900, name: 'GHOST', note: 'Never seen. Never heard. Never there.' },
  { min: 3200, name: 'PHANTOM', note: 'A rumour the guards tell each other.' },
  { min: 2400, name: 'SHADOW', note: 'In and out, with only a chill behind.' },
  { min: 1500, name: 'INFILTRATOR', note: 'The job is done, if not quietly.' },
  { min: 0, name: 'GHOST?', note: 'Loud, lucky, and somehow still free.' },
];

export const COLORS = {
  floorA: '#2a3450',
  floorB: '#26304a',
  floorLine: 'rgba(120,150,220,0.06)',
  shadowFloor: '#1b2338',
  shadowFloorEdge: '#11182a',
  lampFloor: '#2e2a3d',
  wall: '#46557c',
  wallTop: '#5f74a6',
  wallShadow: 'rgba(0,0,0,0.45)',
  crate: '#7a5a36',
  crateEdge: '#9a743f',
  crateDark: '#5d4429',
  door: '#51638c',
  exit: '#2affc4',
  exitDim: '#0f5f4c',
  intel: '#ffd75e',
  player: '#e8ecf5',
  playerCoat: '#3f6fd8',
  guardBody: '#c8433c',
  guardDark: '#7e2a26',
  coneCalm: 'rgba(255,196,92,',
  coneSuspect: 'rgba(255,140,48,',
  coneAlert: 'rgba(255,64,48,',
  darkness: 'rgba(5,7,16,0.64)',
  textDim: '#8fa3c8',
  textBright: '#eef3ff',
};
