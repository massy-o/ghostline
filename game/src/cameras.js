// The building's other eyes: ceiling cameras that sweep a lit floor on a
// slow pendulum. A camera cannot catch you — it has no hands — but stand in
// its cold blue cone until its meter fills and it does the one thing it can:
// it calls the guards to the exact spot where it saw you.

import { CAMERA, TILE } from './config.js';
import { angleDelta, lineOfSight } from './vision.js';

/**
 * Build a camera from a level definition:
 * { col, row, base, sweep, period, phase } — angles in radians, the lens
 * resting at `base` and swinging `sweep` to either side over `period`s.
 */
export function makeCamera(def) {
  return {
    x: def.col * TILE + TILE / 2,
    y: def.row * TILE + TILE / 2,
    base: def.base,
    sweep: def.sweep,
    period: def.period,
    phase: def.phase ?? 0,
    angle: def.base,
    detection: 0,
    seesPlayer: false,
    flash: 0,
  };
}

/** The lens direction at a moment in the floor's life: a smooth pendulum. */
export function sweepAngle(cam, time) {
  return cam.base + Math.sin(cam.phase + (time * Math.PI * 2) / cam.period) * cam.sweep;
}

/** True when the operative stands inside this camera's cone, unoccluded. */
export function cameraSeesPlayer(grid, cam, player) {
  const dx = player.x - cam.x;
  const dy = player.y - cam.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA.range) return { visible: false, dist };
  const bearing = Math.atan2(dy, dx);
  if (angleDelta(bearing, cam.angle) > CAMERA.fovHalfAngle && dist >= 42) {
    return { visible: false, dist };
  }
  if (!lineOfSight(grid, cam.x, cam.y, player.x, player.y)) return { visible: false, dist };
  return { visible: true, dist };
}
