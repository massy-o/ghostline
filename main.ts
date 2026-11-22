// GHOSTLINE — Silent Floors: the hand-in program for make.fun's stealth
// bounty (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static files a
// desktop browser runs offline — a top-down stealth game across three floors
// of a night building, with raycast vision cones, light and shadow that
// detection truly reads, patrols that investigate, search and chase, and a
// scored rank for the whole night. This program copies game/ and the four
// staged screenshots into the output directory and writes dossier.json, the
// summary the pairwise judge reads, with the vendored make.fun library.
//
// Run it the way the grader does:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });

const shotsDir = join(root, 'screenshots');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The gate's caps, mirrored so a bad hand-in fails here first: at most 4
// screenshots of 256 KiB, at most 993 game files and 48 MiB, no game path
// over 1000 bytes, dossier text capped at 160 KiB.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
