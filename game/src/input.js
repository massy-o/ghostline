// Keyboard and mouse: held keys shape a movement vector each frame, and
// presses raise one-shot actions the screens consume.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (KEYMAP[event.code]) {
      held.add(KEYMAP[event.code]);
      event.preventDefault();
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add('sneak');
    } else if (event.code === 'Enter' || event.code === 'Space') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    if (KEYMAP[event.code]) held.delete(KEYMAP[event.code]);
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.delete('sneak');
  });
  canvas.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });
  window.addEventListener('blur', () => held.clear());

  return {
    /** Current movement intent: x/y in -1..1 plus the sneak flag. */
    move() {
      return {
        x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
        y: (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
        sneak: held.has('sneak'),
      };
    },
    /** One-shot actions since the last call; reading them clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
