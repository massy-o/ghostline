// The four screenshot scenes behind ?shot=title|play|shadow|clear. Each one
// stages the real simulation — guards placed mid-behaviour, detection part
// filled, the operative caught in a characteristic moment — and steps it a
// few fixed ticks, so the same seed always frames the same picture.

import { RANKS, TILE } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const IDLE = { x: 0, y: 0, sneak: false };

function tileCentre(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function placePlayer(world, col, row, angle, sneaking) {
  const p = world.state.player;
  const c = tileCentre(col, row);
  p.x = c.x;
  p.y = c.y;
  p.angle = angle;
  p.sneaking = sneaking;
}

function placeGuard(world, index, col, row, angle, state, detection) {
  const g = world.state.guards[index];
  const c = tileCentre(col, row);
  g.x = c.x;
  g.y = c.y;
  g.angle = angle;
  g.state = state;
  g.detection = detection;
  g.lastSeen = { x: world.state.player.x, y: world.state.player.y };
  return g;
}

function step(world, ticks, move = IDLE) {
  for (let i = 0; i < ticks; i += 1) world.step(1 / 60, move);
}

export function stageShot(name, world) {
  if (name === 'play') {
    // Archives: the operative breaks cover and runs — footfall rings
    // spreading to the noise radius — while one guard half-sees her slip
    // along the shelves, another turns to investigate the noise, and a
    // ceiling camera sweeps the room behind them all.
    world.loadLevel(1);
    placePlayer(world, 10, 16, 0, false);
    placeGuard(world, 2, 7, 16, 0, 'suspect', 0.58);
    placeGuard(world, 0, 13, 13, Math.PI, 'investigate', 0.4);
    step(world, 24, { x: 1, y: 0, sneak: false });
    return { screen: SCREEN_PLAY, meta: {} };
  }
  if (name === 'shadow') {
    // The Vault: crouched in the shadow strip while a camera's blue sweep
    // rakes the lamp grid and a guard's warm cone crosses from the east.
    world.loadLevel(2);
    placePlayer(world, 5, 9, 0, true);
    placeGuard(world, 1, 23, 10, Math.PI, 'patrol', 0.3);
    step(world, 12);
    return { screen: SCREEN_PLAY, meta: {} };
  }
  if (name === 'clear') {
    world.loadLevel(2);
    step(world, 30);
    return {
      screen: SCREEN_VICTORY,
      meta: {
        totalScore: 4310,
        best: 4310,
        rank: RANKS[0],
        perLevel: [
          { intelTaken: 3, intelTotal: 3, spotted: 0, score: 1610 },
          { intelTaken: 3, intelTotal: 3, spotted: 0, score: 1450 },
          { intelTaken: 2, intelTotal: 3, spotted: 0, score: 1250 },
        ],
      },
    };
  }
  // Title: the lobby at rest, guards walking their rounds behind the card.
  world.loadLevel(0);
  step(world, 240);
  return { screen: SCREEN_TITLE, meta: { best: 4310 } };
}
