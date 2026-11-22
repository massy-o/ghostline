// GHOSTLINE — Silent Floors. Boot and the screen flow: title, floor briefing,
// play, caught, floor clear, and the night's verdict. The world advances in
// fixed steps; the renderer paints what the simulation says is there.
//
// ?seed=N fixes the floor variation. ?shot=title|play|shadow|clear stages a
// screenshot scene instead of running the loop and sets window.__shotReady.

import { RANKS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAMERA, EVENT_CAUGHT, EVENT_EXIT, EVENT_INTEL, EVENT_SPOTTED, EVENT_SUSPECT } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_BRIEF, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED,
  SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY,
} from './render.js';
import { LEVELS } from './levels.js';
import { stageShot } from './shots.js';

const BEST_KEY = 'ghostline.best';
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private window */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.meta);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let perLevel = [];
  let totalScore = 0;
  let lastScore = { score: 0, intelTaken: 0, intelTotal: 0 };
  let rank = RANKS[RANKS.length - 1];
  let accumulator = 0;
  let last = performance.now();
  let lastStride = 0;

  function announce(message) { status.textContent = message; }

  function meta() {
    return { best, totalScore, perLevel, lastScore, rank };
  }

  function startNight() {
    perLevel = [];
    totalScore = 0;
    world.loadLevel(0);
    screen = SCREEN_BRIEF;
    announce(`${LEVELS[0].name}. ${LEVELS[0].sub}`);
  }

  function finishLevel() {
    const s = world.levelScore();
    lastScore = s;
    perLevel.push({ ...s, spotted: world.state.spottedCount });
    totalScore += s.score;
    audio.clear();
    if (world.state.levelIndex >= LEVELS.length - 1) {
      rank = RANKS.find((r) => totalScore >= r.min) ?? RANKS[RANKS.length - 1];
      if (totalScore > best) { best = totalScore; saveBest(best); }
      screen = SCREEN_VICTORY;
      announce(`Night complete. Score ${totalScore}. Rank ${rank.name}.`);
    } else {
      screen = SCREEN_CLEAR;
      announce(`Floor clear. Score ${s.score}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startNight();
      else if (screen === SCREEN_BRIEF) screen = SCREEN_PLAY;
      else if (screen === SCREEN_CAUGHT) { world.loadLevel(world.state.levelIndex); screen = SCREEN_BRIEF; }
      else if (screen === SCREEN_CLEAR) { world.loadLevel(world.state.levelIndex + 1); screen = SCREEN_BRIEF; }
      else if (screen === SCREEN_VICTORY) startNight();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
  }

  function stepOnce() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sneak: false });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.move());
    if (events & EVENT_INTEL) audio.intel();
    if (events & EVENT_CAMERA) audio.camera();
    if (events & EVENT_SUSPECT) audio.suspect();
    if (events & EVENT_SPOTTED) audio.spotted();
    const stride = Math.floor(world.state.player.stride);
    if (stride !== lastStride) {
      lastStride = stride;
      if (world.state.player.moving && !world.state.player.sneaking) audio.step();
    }
    if (events & EVENT_CAUGHT) {
      screen = SCREEN_CAUGHT;
      audio.caught();
      announce('Spotted. The floor is lost.');
    } else if (events & EVENT_EXIT) {
      finishLevel();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepOnce();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, meta());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });

  announce('Ghostline. Silent Floors. Press Enter to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
