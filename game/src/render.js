// The look: a noir top-down floor at night. A static layer paints the floor
// once per level; every frame the operative, the guards and their true
// raycast vision cones are drawn, then a lighting pass drops darkness over
// everything the lamps, the lift and the cones do not hold back.

import { CAMERA, COLORS, GUARD, TILE, VIEW } from './config.js';
import { LEVELS } from './levels.js';
import { tileHash } from './random.js';
import { conePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_VICTORY = 'victory';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const light = makeCanvas(VIEW.width, VIEW.height);
  const lightCtx = light.getContext('2d');
  const floorCache = new Map();

  function text(str, x, y, opts = {}) {
    const { size = 16, color = COLORS.textBright, align = 'left', weight = 600, spacing = 0, alpha = 1 } = opts;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px "Avenir Next", "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    try { ctx.letterSpacing = `${spacing}px`; } catch { /* older engines */ }
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function floorLayer(state) {
    if (floorCache.has(state.levelIndex)) return floorCache.get(state.levelIndex);
    const layer = makeCanvas(VIEW.width, VIEW.height);
    const g = layer.getContext('2d');
    const grid = state.grid;
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        const ch = grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === '#') continue;
        const base = ch === ',' ? COLORS.shadowFloor : (col + row) % 2 ? COLORS.floorA : COLORS.floorB;
        g.fillStyle = base;
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = `rgba(255,255,255,${tileHash(col, row) * 0.03})`;
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = COLORS.floorLine;
        g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (ch === ',') {
          g.strokeStyle = COLORS.shadowFloorEdge;
          g.lineWidth = 3;
          g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
          g.lineWidth = 1;
        }
        if (ch === 'L') {
          const grad = g.createRadialGradient(x + 15, y + 15, 2, x + 15, y + 15, 44);
          grad.addColorStop(0, 'rgba(255,196,100,0.34)');
          grad.addColorStop(1, 'rgba(255,196,100,0)');
          g.fillStyle = grad;
          g.fillRect(x - 14, y - 14, TILE + 28, TILE + 28);
          g.fillStyle = '#ffd98c';
          g.beginPath();
          g.arc(x + 15, y + 15, 2.4, 0, Math.PI * 2);
          g.fill();
        }
        if (ch === '=') {
          g.fillStyle = 'rgba(0,0,0,0.28)';
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = COLORS.door;
          g.fillRect(x + 3, y, 3, TILE);
          g.fillRect(x + TILE - 6, y, 3, TILE);
        }
        if (ch === 'E') {
          g.fillStyle = '#0b2e27';
          g.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
          g.strokeStyle = COLORS.exit;
          g.lineWidth = 2;
          g.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          g.lineWidth = 1;
          g.fillStyle = COLORS.exit;
          for (let k = 0; k < 2; k += 1) {
            const cx = x + 10 + k * 8;
            g.beginPath();
            g.moveTo(cx, y + 9);
            g.lineTo(cx + 6, y + 15);
            g.lineTo(cx, y + 21);
            g.closePath();
            g.fill();
          }
        }
      }
    }
    // Walls and crates stand proud of the floor: shadow first, then the body.
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        const ch = grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === '#') {
          g.fillStyle = COLORS.wallShadow;
          g.fillRect(x + 3, y + 5, TILE, TILE);
          g.fillStyle = COLORS.wall;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = COLORS.wallTop;
          g.fillRect(x, y, TILE, 4);
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x, y + TILE - 4, TILE, 4);
        } else if (ch === 'C') {
          g.fillStyle = COLORS.wallShadow;
          g.fillRect(x + 3, y + 5, TILE - 4, TILE - 4);
          g.fillStyle = COLORS.crate;
          g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          g.strokeStyle = COLORS.crateEdge;
          g.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          g.strokeStyle = COLORS.crateDark;
          g.beginPath();
          g.moveTo(x + 4, y + 4);
          g.lineTo(x + TILE - 4, y + TILE - 4);
          g.moveTo(x + TILE - 4, y + 4);
          g.lineTo(x + 4, y + TILE - 4);
          g.stroke();
        }
      }
    }
    floorCache.set(state.levelIndex, layer);
    return layer;
  }

  function lampCentres(state) {
    const out = [];
    state.grid.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === 'L') out.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
      });
    });
    return out;
  }

  function drawBody(x, y, angle, bodyColor, trimColor, crouched) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 5, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    if (crouched) ctx.ellipse(x, y, 11, 8, 0, 0, Math.PI * 2);
    else ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = trimColor;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 3.5, y + Math.sin(angle) * 3.5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = trimColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawPlay(state) {
    ctx.drawImage(floorLayer(state), 0, 0);
    const p = state.player;

    // Intel: a small bright diamond, turning slowly.
    for (const intel of state.intels) {
      if (intel.taken) continue;
      const bob = Math.sin(state.time * 2.4 + intel.phase) * 2;
      ctx.save();
      ctx.translate(intel.x, intel.y + bob);
      ctx.rotate(state.time * 1.4 + intel.phase);
      ctx.fillStyle = COLORS.intel;
      ctx.shadowColor = COLORS.intel;
      ctx.shadowBlur = 12;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }

    drawBody(p.x, p.y, p.angle, COLORS.playerCoat, COLORS.player, p.sneaking);
    for (const guard of state.guards) {
      drawBody(guard.x, guard.y, guard.angle, COLORS.guardBody, '#f3d9a4', false);
    }

    // Ceiling cameras: a dark housing that turns with its lens, and an LED
    // that burns red while it is looking at you.
    for (const cam of state.cameras ?? []) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(2, 5, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(cam.angle);
      ctx.fillStyle = COLORS.cameraBody;
      ctx.strokeStyle = 'rgba(180,220,255,0.5)';
      ctx.beginPath();
      ctx.roundRect(-8, -6, 17, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.cameraLens;
      ctx.beginPath();
      ctx.arc(8, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const led = cam.seesPlayer ? '#ff4030' : cam.flash > 0 ? '#ff4030' : '#57e6a9';
      ctx.fillStyle = led;
      ctx.beginPath();
      ctx.arc(cam.x - 9, cam.y - 9, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lighting: darkness, holes where light lives, then the cones themselves.
    lightCtx.save();
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.clearRect(0, 0, VIEW.width, VIEW.height);
    lightCtx.fillStyle = COLORS.darkness;
    lightCtx.fillRect(0, 0, VIEW.width, VIEW.height);
    lightCtx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, strength) => {
      const grad = lightCtx.createRadialGradient(x, y, 2, x, y, r);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.fillStyle = grad;
      lightCtx.beginPath();
      lightCtx.arc(x, y, r, 0, Math.PI * 2);
      lightCtx.fill();
    };
    for (const lamp of lampCentres(state)) hole(lamp.x, lamp.y, 88, 0.9);
    if (state.exit) hole(state.exit.x, state.exit.y, 58, 0.78);
    hole(p.x, p.y, 76, 0.78);
    for (const guard of state.guards) hole(guard.x, guard.y, 44, 0.6);
    lightCtx.globalCompositeOperation = 'source-over';
    // Camera cones first: a cold blue wash under the guards' warm light.
    for (const cam of state.cameras ?? []) {
      const poly = conePolygon(state.grid, cam.x, cam.y, cam.angle, CAMERA.fovHalfAngle, CAMERA.range);
      const alpha = cam.flash > 0 ? 0.44 : cam.seesPlayer ? 0.36 : 0.2 + cam.detection * 0.12;
      lightCtx.save();
      lightCtx.beginPath();
      poly.forEach(([px, py], i) => (i ? lightCtx.lineTo(px, py) : lightCtx.moveTo(px, py)));
      lightCtx.closePath();
      lightCtx.clip();
      const grad = lightCtx.createRadialGradient(cam.x, cam.y, 6, cam.x, cam.y, CAMERA.range);
      grad.addColorStop(0, `${COLORS.coneCamera}${alpha})`);
      grad.addColorStop(0.75, `${COLORS.coneCamera}${alpha * 0.5})`);
      grad.addColorStop(1, `${COLORS.coneCamera}0)`);
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(cam.x - CAMERA.range, cam.y - CAMERA.range, CAMERA.range * 2, CAMERA.range * 2);
      lightCtx.restore();
    }
    for (const guard of state.guards) {
      const poly = conePolygon(state.grid, guard.x, guard.y, guard.angle, GUARD.fovHalfAngle, GUARD.viewRange);
      const base = guard.state === 'chase' ? COLORS.coneAlert : guard.detection >= 0.45 ? COLORS.coneSuspect : COLORS.coneCalm;
      const alpha = guard.state === 'chase' ? 0.46 : guard.detection >= 0.45 ? 0.38 : 0.28;
      lightCtx.save();
      lightCtx.beginPath();
      poly.forEach(([px, py], i) => (i ? lightCtx.lineTo(px, py) : lightCtx.moveTo(px, py)));
      lightCtx.closePath();
      lightCtx.clip();
      const grad = lightCtx.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, GUARD.viewRange);
      grad.addColorStop(0, `${base}${alpha})`);
      grad.addColorStop(0.75, `${base}${alpha * 0.55})`);
      grad.addColorStop(1, `${base}0)`);
      lightCtx.fillStyle = grad;
      lightCtx.fillRect(guard.x - GUARD.viewRange, guard.y - GUARD.viewRange, GUARD.viewRange * 2, GUARD.viewRange * 2);
      lightCtx.restore();
    }
    lightCtx.restore();
    ctx.drawImage(light, 0, 0);

    // Last-seen markers: where a searching guard believes you vanished.
    for (const guard of state.guards) {
      if ((guard.state === 'search' || guard.state === 'investigate') && guard.lastSeen) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,170,80,0.55)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(guard.lastSeen.x, guard.lastSeen.y, 13 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Guard indicators: detection arc and state mark.
    for (const guard of state.guards) {
      if (guard.detection > 0.03) {
        ctx.strokeStyle = 'rgba(10,12,20,0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y - 20, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = guard.detection >= 1 ? '#ff4030' : guard.detection >= 0.45 ? '#ff9a3c' : '#e8ecf5';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y - 20, 8, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      const mark = guard.state === 'chase' ? '!' : guard.detection >= 0.45 || guard.state === 'search' || guard.state === 'investigate' ? '?' : '';
      if (mark) {
        const bounce = guard.state === 'chase' ? Math.abs(Math.sin(state.time * 9)) * 3 : 0;
        text(mark, guard.x, guard.y - 36 - bounce, {
          size: 19, align: 'center', weight: 800,
          color: guard.state === 'chase' ? '#ff5040' : '#ffb054',
        });
      }
    }

    // Camera meters: the same arc language as the guards, in lens cyan —
    // and a red ring the moment one trips and calls for help.
    for (const cam of state.cameras ?? []) {
      if (cam.detection > 0.03) {
        ctx.strokeStyle = 'rgba(10,12,20,0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cam.x, cam.y - 20, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = cam.detection >= 0.75 ? '#ff5040' : '#7fd4ff';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cam.x, cam.y - 20, 8, -Math.PI / 2, -Math.PI / 2 + cam.detection * Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (cam.flash > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,64,48,${0.75 * cam.flash})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cam.x, cam.y, 16 + (1 - cam.flash) * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawHud(state);
    vignette();
  }

  function drawHud(state) {
    const level = LEVELS[state.levelIndex];
    ctx.fillStyle = 'rgba(5,8,15,0.72)';
    ctx.fillRect(0, 0, VIEW.width, 34);
    text(level.name, 14, 17, { size: 14, spacing: 2, color: COLORS.textBright });
    const statusColor = { UNSEEN: '#57e6a9', SUSPECTED: '#ffb054', SEARCHING: '#ff8438', HUNTED: '#ff5040' }[state.status];
    text(state.status, VIEW.width / 2 - 52, 17, { size: 13, spacing: 2, color: statusColor, align: 'right' });
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(VIEW.width / 2 - 44, 11, 120, 11);
    ctx.fillStyle = statusColor;
    ctx.fillRect(VIEW.width / 2 - 44, 11, 120 * state.alarm, 11);
    const taken = state.intels.filter((i) => i.taken).length;
    const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
    const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
    text(`◆ ${taken}/${state.intels.length}    ${mm}:${ss}`, VIEW.width - 14, 17, { size: 14, align: 'right', color: COLORS.textDim });
    text('WASD / ARROWS — move    SHIFT — sneak    blue sweeps are cameras: a full meter calls the guards    P — pause', 14, VIEW.height - 13, { size: 11, color: COLORS.textDim, alpha: 0.75 });
    if (state.player.sneaking) {
      text('SNEAKING', VIEW.width - 14, VIEW.height - 13, { size: 11, align: 'right', color: '#57e6a9', alpha: 0.9 });
    }
  }

  function vignette() {
    const grad = ctx.createRadialGradient(480, 300, 260, 480, 300, 620);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.44)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function panel(alpha = 0.78) {
    ctx.fillStyle = `rgba(4,6,12,${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawTitle(state, meta) {
    drawPlay(state);
    panel(0.55);
    text('G H O S T L I N E', VIEW.width / 2, 168, { size: 72, align: 'center', weight: 800, color: '#f2f6ff' });
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(VIEW.width / 2 - 190, 208, 380, 2);
    text('SILENT FLOORS', VIEW.width / 2, 234, { size: 21, align: 'center', spacing: 10, color: COLORS.exit });
    text('Three floors. One operative. Every guard awake.', VIEW.width / 2, 286, { size: 16, align: 'center', color: COLORS.textDim, weight: 500 });
    text('Reach the lift on each floor, unseen. Take the intel if you dare.', VIEW.width / 2, 312, { size: 16, align: 'center', color: COLORS.textDim, weight: 500 });
    text('ENTER — begin the night', VIEW.width / 2, 386, { size: 19, align: 'center', color: COLORS.textBright });
    text('WASD / ARROWS move · SHIFT sneak · P pause · M mute', VIEW.width / 2, 420, { size: 13, align: 'center', color: COLORS.textDim });
    LEVELS.forEach((level, i) => {
      text(level.name, VIEW.width / 2, 472 + i * 24, { size: 13, align: 'center', spacing: 2, color: COLORS.textDim });
    });
    if (meta.best > 0) text(`BEST NIGHT — ${meta.best}`, VIEW.width / 2, 556, { size: 13, align: 'center', color: COLORS.intel });
  }

  function drawBrief(state) {
    drawPlay(state);
    panel(0.66);
    const level = LEVELS[state.levelIndex];
    text(level.name, VIEW.width / 2, 226, { size: 34, align: 'center', weight: 800, spacing: 3 });
    text(level.sub, VIEW.width / 2, 272, { size: 17, align: 'center', color: COLORS.textDim, weight: 500 });
    text(`Intel on this floor: ◆ × ${state.intels.length} · Par ${level.parSeconds}s`, VIEW.width / 2, 322, { size: 15, align: 'center', color: COLORS.textBright });
    text('Stay out of the cones. Shadow carpet and a low crouch slow their suspicion.', VIEW.width / 2, 352, { size: 14, align: 'center', color: COLORS.textDim, weight: 500 });
    text('The blue sweeps are ceiling cameras — cross in the blind moment, or the guards come running.', VIEW.width / 2, 378, { size: 14, align: 'center', color: COLORS.textDim, weight: 500 });
    text('ENTER — go in', VIEW.width / 2, 410, { size: 18, align: 'center' });
  }

  function drawCaught(state) {
    drawPlay(state);
    ctx.fillStyle = 'rgba(120,10,6,0.42)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SPOTTED', VIEW.width / 2, 258, { size: 56, align: 'center', weight: 800, spacing: 6, color: '#ff6a55' });
    text('The floor is lost — but the night is not.', VIEW.width / 2, 312, { size: 16, align: 'center', color: COLORS.textBright });
    text('ENTER — work the same floor again', VIEW.width / 2, 356, { size: 16, align: 'center', color: COLORS.textDim });
  }

  function drawClear(state, meta) {
    drawPlay(state);
    panel(0.7);
    const s = meta.lastScore;
    text('FLOOR CLEAR', VIEW.width / 2, 196, { size: 40, align: 'center', weight: 800, spacing: 4, color: '#57e6a9' });
    const rows = [
      ['Time', `${Math.round(state.time)}s`],
      ['Intel', `◆ ${s.intelTaken}/${s.intelTotal}`],
      ['Times spotted', `${state.spottedCount}`],
      ['Floor score', `${s.score}`],
    ];
    rows.forEach(([k, v], i) => {
      text(k, VIEW.width / 2 - 130, 262 + i * 34, { size: 17, color: COLORS.textDim });
      text(v, VIEW.width / 2 + 130, 262 + i * 34, { size: 17, align: 'right', color: COLORS.textBright });
    });
    text('ENTER — next floor', VIEW.width / 2, 428, { size: 17, align: 'center' });
  }

  function drawVictory(state, meta) {
    drawPlay(state);
    panel(0.8);
    text('NIGHT COMPLETE', VIEW.width / 2, 138, { size: 38, align: 'center', weight: 800, spacing: 4 });
    text(meta.rank.name, VIEW.width / 2, 216, { size: 64, align: 'center', weight: 800, spacing: 8, color: COLORS.exit });
    text(meta.rank.note, VIEW.width / 2, 262, { size: 15, align: 'center', color: COLORS.textDim, weight: 500 });
    text(`TOTAL SCORE — ${meta.totalScore}`, VIEW.width / 2, 312, { size: 22, align: 'center', color: COLORS.textBright });
    meta.perLevel.forEach((s, i) => {
      text(`${LEVELS[i].name} — ◆ ${s.intelTaken}/${s.intelTotal} · spotted ${s.spotted} · ${s.score} pts`,
        VIEW.width / 2, 356 + i * 26, { size: 14, align: 'center', color: COLORS.textDim });
    });
    if (meta.totalScore >= meta.best && meta.best > 0) {
      text('A new best night.', VIEW.width / 2, 448, { size: 14, align: 'center', color: COLORS.intel });
    }
    text('ENTER — another night', VIEW.width / 2, 492, { size: 16, align: 'center' });
  }

  function draw(state, screen, meta = {}) {
    const full = { best: 0, totalScore: 0, perLevel: [], lastScore: { score: 0, intelTaken: 0, intelTotal: 0 }, rank: { name: '', note: '' }, ...meta };
    switch (screen) {
      case SCREEN_TITLE: drawTitle(state, full); break;
      case SCREEN_BRIEF: drawBrief(state); break;
      case SCREEN_CAUGHT: drawCaught(state); break;
      case SCREEN_CLEAR: drawClear(state, full); break;
      case SCREEN_VICTORY: drawVictory(state, full); break;
      case SCREEN_PAUSED:
        drawPlay(state);
        panel(0.5);
        text('PAUSED', VIEW.width / 2, 300, { size: 34, align: 'center', weight: 800, spacing: 6 });
        break;
      default: drawPlay(state);
    }
  }

  return { draw };
}
