[![make.fun bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/massy-o/ghostline/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/massy-o/ghostline/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# GHOSTLINE — Silent Floors

A top-down stealth game for the desktop browser. One operative, three floors
of the Kestrel Building at night, and every guard awake.

Reach the lift on each floor **unseen**. Take the glowing intel if you dare.
Your night is scored and ranked — GHOST is earned, never given.

## How it plays

- **Move** — WASD or arrow keys. **Sneak** — hold SHIFT: slower, quieter, and
  harder to see. **Pause** — P. **Mute** — M. Menus take ENTER or a click.
- Guards patrol waypoints with **true raycast vision cones**: walls, crates
  and curtained doorways block their sight exactly as drawn.
- Detection is a quantity, not a switch. It fills faster up close, in lamp
  light, and when you run; slower in shadow carpet, crouched low, or holding
  still. Running feet are *heard* — nearby guards come to look.
- A half-seen shape makes a guard stop and stare (`?`). A certain one gives
  chase (`!`). Break their sight and they search where you vanished, then
  settle back to their rounds.
- Score: a base per floor, a bonus per intel, a bonus for never being
  spotted, and a slow bleed for every second inside.

## The floors

1. **Lobby** — slip the night desk.
2. **Archives** — what the shelves hide.
3. **The Vault** — one room, one prize, every eye in the building.

## Running it

The game is plain static files under `game/` — no build, no network. Serve
the folder (`node serve.ts`, then http://localhost:8080) or hand it to any
static host. `main.ts` is the make.fun hand-in program: it copies `game/` and
`screenshots/` to the output directory and writes the judge's dossier.

MIT licensed.
