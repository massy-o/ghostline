// The simulation: one floor at a time. The operative slips between patrols;
// guards walk their rounds, stare when something is half-seen, chase when it
// is certain, and search where it vanished. Detection is a quantity, not a
// switch — light, shadow, posture and distance all feed it.

import { CAMERA, DETECTION, GUARD, PLAYER, SCORE, TILE } from './config.js';
import { LEVELS, SOLID, TILE_INTEL, TILE_LAMP, TILE_SHADOW } from './levels.js';
import { angleDelta, lineOfSight, tileAt, turnToward } from './vision.js';
import { cameraSeesPlayer, makeCamera, sweepAngle } from './cameras.js';

export const EVENT_NONE = 0;
export const EVENT_INTEL = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_EXIT = 8;
export const EVENT_SUSPECT = 16;
export const EVENT_NOISE = 32;
export const EVENT_CAMERA = 64;

const GUARD_PATROL = 'patrol';
const GUARD_SUSPECT = 'suspect';
const GUARD_INVESTIGATE = 'investigate';
const GUARD_CHASE = 'chase';
const GUARD_SEARCH = 'search';

function centre(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function solidAt(grid, x, y) {
  return SOLID.has(tileAt(grid, Math.floor(x / TILE), Math.floor(y / TILE)));
}

/** Move a circle by (dx, dy), sliding along whatever it cannot enter. */
function slideMove(grid, body, dx, dy) {
  const r = body.radius;
  let nx = body.x + dx;
  if (!solidAt(grid, nx + Math.sign(dx) * r, body.y - r + 2)
    && !solidAt(grid, nx + Math.sign(dx) * r, body.y + r - 2)
    && !solidAt(grid, nx + Math.sign(dx) * r, body.y)) {
    body.x = nx;
  }
  let ny = body.y + dy;
  if (!solidAt(grid, body.x - r + 2, ny + Math.sign(dy) * r)
    && !solidAt(grid, body.x + r - 2, ny + Math.sign(dy) * r)
    && !solidAt(grid, body.x, ny + Math.sign(dy) * r)) {
    body.y = ny;
  }
}

function makeGuard(grid, spawn, patrol, index) {
  const start = centre(spawn[0], spawn[1]);
  const points = patrol.points.map(([c, r]) => centre(c, r));
  const first = points[0];
  return {
    index,
    x: start.x,
    y: start.y,
    radius: GUARD.radius,
    angle: Math.atan2(first.y - start.y, first.x - start.x),
    state: GUARD_PATROL,
    points,
    wp: 0,
    detection: 0,
    sawPlayer: false,
    lastSeen: null,
    unseenFor: 0,
    stateTime: 0,
    target: null,
    alerted: false,
    scanBase: 0,
  };
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    grid: [],
    player: null,
    guards: [],
    cameras: [],
    intels: [],
    exit: null,
    time: 0,
    spottedCount: 0,
    alarm: 0,
    status: 'UNSEEN',
    finished: false,
    ripples: [],
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.grid = level.map.map((row) => [...row]);
    state.guards = [];
    state.cameras = (level.cameras ?? []).map(makeCamera);
    state.intels = [];
    state.exit = null;
    state.time = 0;
    state.spottedCount = 0;
    state.alarm = 0;
    state.status = 'UNSEEN';
    state.finished = false;
    state.ripples = [];
    let guardIndex = 0;
    level.map.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === 'P') {
          const p = centre(c, r);
          state.player = {
            x: p.x, y: p.y, radius: PLAYER.radius, angle: -Math.PI / 2,
            sneaking: false, moving: false, stride: 0, rippleTimer: 0,
          };
        } else if (ch === 'G') {
          state.guards.push(makeGuard(state.grid, [c, r], level.patrols[guardIndex], guardIndex));
          guardIndex += 1;
        } else if (ch === TILE_INTEL) {
          const p = centre(c, r);
          state.intels.push({ x: p.x, y: p.y, taken: false, phase: random.range(0, Math.PI * 2) });
        } else if (ch === 'E') {
          state.exit = { col: c, row: r, ...centre(c, r) };
        }
      });
    });
  }

  function playerTile() {
    const p = state.player;
    return tileAt(state.grid, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  }

  /** How exposed the operative is right now, as a multiplier on detection. */
  function exposure(guard, dist) {
    const p = state.player;
    let factor = 1 - DETECTION.fillRangeFactor * (dist / GUARD.viewRange);
    const tile = playerTile();
    if (tile === TILE_SHADOW) factor *= DETECTION.shadowFactor;
    if (tile === TILE_LAMP) factor *= 1.5;
    if (p.sneaking) factor *= DETECTION.sneakFactor;
    if (!p.moving) factor *= DETECTION.stillFactor;
    if (dist < 30) factor *= 2.2;
    return factor;
  }

  /** The same exposure story, read by a lens instead of an eye. */
  function cameraExposure(dist) {
    const p = state.player;
    let factor = 1 - DETECTION.fillRangeFactor * (dist / CAMERA.range);
    const tile = playerTile();
    if (tile === TILE_SHADOW) factor *= DETECTION.shadowFactor;
    if (tile === TILE_LAMP) factor *= 1.5;
    if (p.sneaking) factor *= DETECTION.sneakFactor;
    if (!p.moving) factor *= DETECTION.stillFactor;
    if (dist < 30) factor *= 2.2;
    return factor;
  }

  /** Advance one camera: swing the lens, read the floor, call for help. */
  function stepCamera(cam, dt, events) {
    const p = state.player;
    cam.angle = sweepAngle(cam, state.time);
    cam.flash = Math.max(0, cam.flash - dt * 1.6);
    const sight = cameraSeesPlayer(state.grid, cam, p);
    cam.seesPlayer = sight.visible;
    if (sight.visible) {
      cam.detection = Math.min(1, cam.detection + CAMERA.fillPerSecond * cameraExposure(sight.dist) * dt);
      if (cam.detection >= 1) {
        cam.detection = CAMERA.resetTo;
        cam.flash = 1;
        events |= EVENT_CAMERA;
        // The lens has no hands: it sends the nearest free guards to look.
        const free = state.guards
          .filter((g) => g.state === GUARD_PATROL || g.state === GUARD_SUSPECT)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        for (const guard of free.slice(0, CAMERA.dispatchCount)) {
          guard.state = GUARD_INVESTIGATE;
          guard.target = { x: p.x, y: p.y };
          guard.stateTime = 0;
          guard.detection = Math.max(guard.detection, 0.6);
          guard.lastSeen = { x: p.x, y: p.y };
        }
      }
    } else {
      cam.detection = Math.max(0, cam.detection - CAMERA.decayPerSecond * dt);
    }
    return events;
  }

  function guardSeesPlayer(guard) {
    const p = state.player;
    const dx = p.x - guard.x;
    const dy = p.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.viewRange) return { visible: false, dist };
    const bearing = Math.atan2(dy, dx);
    const inCone = angleDelta(bearing, guard.angle) <= GUARD.fovHalfAngle;
    const inPeriphery = dist < 42 && angleDelta(bearing, guard.angle) <= 1.9;
    if (!inCone && !inPeriphery) return { visible: false, dist };
    if (!lineOfSight(state.grid, guard.x, guard.y, p.x, p.y)) return { visible: false, dist };
    return { visible: true, dist };
  }

  function moveGuard(guard, tx, ty, speed, dt) {
    const dx = tx - guard.x;
    const dy = ty - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 2) guard.angle = turnToward(guard.angle, Math.atan2(dy, dx), 3.4 * dt);
    const stepLen = Math.min(dist, speed * dt);
    if (stepLen > 0) {
      slideMove(state.grid, guard, Math.cos(guard.angle) * stepLen, Math.sin(guard.angle) * stepLen);
    }
    return dist;
  }

  function stepGuard(guard, dt, events) {
    const p = state.player;
    const sight = guardSeesPlayer(guard);
    guard.sawPlayer = sight.visible;

    if (sight.visible) {
      guard.lastSeen = { x: p.x, y: p.y };
      guard.unseenFor = 0;
      const before = guard.detection;
      guard.detection = Math.min(1, guard.detection + DETECTION.fillPerSecond * exposure(guard, sight.dist) * dt);
      if (before < DETECTION.suspectAt && guard.detection >= DETECTION.suspectAt && guard.state === GUARD_PATROL) {
        guard.state = GUARD_SUSPECT;
        guard.stateTime = 0;
        events |= EVENT_SUSPECT;
      }
      if (guard.detection >= DETECTION.alertAt && guard.state !== GUARD_CHASE) {
        guard.state = GUARD_CHASE;
        guard.stateTime = 0;
        if (!guard.alerted) {
          guard.alerted = true;
          state.spottedCount += 1;
          events |= EVENT_SPOTTED;
        }
        // A shout carries: nearby patrols converge on the last-seen point.
        for (const other of state.guards) {
          if (other !== guard && other.state === GUARD_PATROL
            && Math.hypot(other.x - guard.x, other.y - guard.y) < 240) {
            other.state = GUARD_INVESTIGATE;
            other.target = { ...guard.lastSeen };
            other.stateTime = 0;
            other.detection = Math.max(other.detection, 0.5);
          }
        }
      }
      if (sight.dist < GUARD.catchDistance) events |= EVENT_CAUGHT;
    } else {
      guard.unseenFor += dt;
      const decay = guard.state === GUARD_CHASE ? DETECTION.decayPerSecond * 0.4 : DETECTION.decayPerSecond;
      guard.detection = Math.max(0, guard.detection - decay * dt);
    }

    guard.stateTime += dt;
    switch (guard.state) {
      case GUARD_PATROL: {
        if (guard.detection > 0.62 && guard.lastSeen) {
          guard.state = GUARD_INVESTIGATE;
          guard.target = guard.lastSeen;
          guard.stateTime = 0;
          break;
        }
        const wp = guard.points[guard.wp];
        if (moveGuard(guard, wp.x, wp.y, GUARD.patrolSpeed, dt) < 6) {
          guard.wp = (guard.wp + 1) % guard.points.length;
        }
        break;
      }
      case GUARD_SUSPECT: {
        if (p) guard.angle = turnToward(guard.angle, Math.atan2(p.y - guard.y, p.x - guard.x), 2.6 * dt);
        if (guard.detection <= 0.12) {
          guard.state = GUARD_PATROL;
          guard.alerted = false;
        }
        break;
      }
      case GUARD_INVESTIGATE: {
        const t = guard.target ?? guard.lastSeen;
        if (t && moveGuard(guard, t.x, t.y, GUARD.investigateSpeed, dt) < 8) {
          guard.angle += Math.sin(guard.stateTime * 2.2) * 0.9 * dt;
          if (guard.stateTime > 2.4) {
            guard.state = GUARD_PATROL;
            guard.detection = Math.min(guard.detection, 0.3);
            guard.alerted = false;
          }
        }
        break;
      }
      case GUARD_CHASE: {
        const t = guard.lastSeen ?? { x: p.x, y: p.y };
        moveGuard(guard, t.x, t.y, GUARD.chaseSpeed, dt);
        if (guard.unseenFor > GUARD.loseSightAfter) {
          guard.state = GUARD_SEARCH;
          guard.stateTime = 0;
          guard.scanBase = guard.angle;
        }
        break;
      }
      case GUARD_SEARCH: {
        guard.angle = guard.scanBase + Math.sin(guard.stateTime * 1.5) * 1.05;
        guard.detection = Math.min(guard.detection, 0.45);
        if (guard.stateTime > GUARD.searchSeconds) {
          guard.state = GUARD_PATROL;
          guard.alerted = false;
          guard.detection = 0.25;
        }
        break;
      }
      default:
        break;
    }
    return events;
  }

  function step(dt, move) {
    if (state.finished) return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += dt;
    const p = state.player;

    // The operative.
    p.sneaking = !!move.sneak;
    p.moving = !!(move.x || move.y);
    if (p.moving) {
      const len = Math.hypot(move.x, move.y) || 1;
      const speed = p.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      slideMove(state.grid, p, (move.x / len) * speed * dt, (move.y / len) * speed * dt);
      p.angle = Math.atan2(move.y, move.x);
      p.stride += dt * (p.sneaking ? 6 : 10);
      if (!p.sneaking) {
        // Running feet carry — and the renderer draws each footfall ring so
        // the player can see exactly how far their noise reaches.
        p.rippleTimer -= dt;
        if (p.rippleTimer <= 0) {
          state.ripples.push({ x: p.x, y: p.y, t: 0 });
          p.rippleTimer = 0.26;
        }
        // Nearby guards come to look.
        for (const guard of state.guards) {
          const d = Math.hypot(guard.x - p.x, guard.y - p.y);
          if (d < PLAYER.noiseRadius && guard.state === GUARD_PATROL) {
            guard.state = GUARD_INVESTIGATE;
            guard.target = { x: p.x, y: p.y };
            guard.stateTime = 0;
            guard.detection = Math.max(guard.detection, 0.5);
            events |= EVENT_NOISE;
          }
        }
      }
    }

    // Intel is taken by walking over it.
    for (const intel of state.intels) {
      if (!intel.taken && Math.hypot(intel.x - p.x, intel.y - p.y) < 16) {
        intel.taken = true;
        events |= EVENT_INTEL;
      }
    }

    // The lift ends the floor.
    if (state.exit && Math.floor(p.x / TILE) === state.exit.col && Math.floor(p.y / TILE) === state.exit.row) {
      state.finished = true;
      events |= EVENT_EXIT;
    }

    // Footfall rings expand and fade.
    for (const ripple of state.ripples) ripple.t += dt;
    state.ripples = state.ripples.filter((ripple) => ripple.t < 0.85);

    for (const guard of state.guards) events = stepGuard(guard, dt, events);
    for (const cam of state.cameras) events = stepCamera(cam, dt, events);
    if (events & EVENT_CAUGHT) state.finished = true;

    // The building's mood, for the HUD: the most-aware eye, human or lens.
    state.alarm = state.guards.reduce((m, g) => Math.max(m, g.detection), 0);
    state.alarm = state.cameras.reduce((m, c) => Math.max(m, c.detection), state.alarm);
    const anyChase = state.guards.some((g) => g.state === GUARD_CHASE);
    const anySearch = state.guards.some((g) => g.state === GUARD_SEARCH || g.state === GUARD_INVESTIGATE);
    state.status = anyChase ? 'HUNTED' : state.alarm >= DETECTION.suspectAt ? 'SUSPECTED' : anySearch ? 'SEARCHING' : 'UNSEEN';
    return events;
  }

  /** Points for the floor just finished, from its own statistics. */
  function levelScore() {
    const taken = state.intels.filter((i) => i.taken).length;
    let score = SCORE.levelBase + taken * SCORE.intelBonus
      + Math.round(state.time) * SCORE.perSecond
      + state.spottedCount * SCORE.perSpotted;
    if (state.spottedCount === 0) score += SCORE.unseenBonus;
    return { score: Math.max(100, score), intelTaken: taken, intelTotal: state.intels.length };
  }

  loadLevel(0);
  return { state, loadLevel, step, levelScore };
}
