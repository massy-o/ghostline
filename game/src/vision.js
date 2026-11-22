// Sight, worked out honestly: a look is blocked by walls, crates and curtained
// doorways, and a guard's vision cone is a fan of rays that stop at the first
// blocker — so the cone the player sees is the cone the guard truly has.

import { TILE } from './config.js';
import { SIGHT_BLOCK } from './levels.js';

export function tileAt(grid, col, row) {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) return '#';
  return grid[row][col];
}

export function blocksSight(grid, col, row) {
  return SIGHT_BLOCK.has(tileAt(grid, col, row));
}

/** March a ray in small steps; return the distance it travels before a blocker. */
export function rayDistance(grid, x, y, angle, maxDist) {
  const step = 4;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  let travelled = 0;
  while (travelled < maxDist) {
    px += dx;
    py += dy;
    travelled += step;
    if (blocksSight(grid, Math.floor(px / TILE), Math.floor(py / TILE))) {
      return travelled - step / 2;
    }
  }
  return maxDist;
}

/** True when nothing that blocks sight stands between the two points. */
export function lineOfSight(grid, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    if (blocksSight(grid, Math.floor(px / TILE), Math.floor(py / TILE))) return false;
  }
  return true;
}

/** The visible fan of a guard's cone: origin plus one point per cast ray. */
export function conePolygon(grid, x, y, angle, halfAngle, range, rays = 26) {
  const points = [[x, y]];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = rayDistance(grid, x, y, a, range);
    points.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return points;
}

/** Smallest absolute difference between two angles, in [0, PI]. */
export function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Turn `current` toward `target` by at most `maxStep` radians. */
export function turnToward(current, target, maxStep) {
  let d = (target - current) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}
