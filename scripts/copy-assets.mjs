// Copy non-TS runtime assets into dist after `tsc`. Handlers read a
// sibling prompt.md at module load; tsc only emits .js, so without this
// `node dist/cli.js` (Action mode) fails with ENOENT on prompt.md.
//
// Copies every src/**/*.md into the mirrored dist path.

import { readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const SRC = "src";
const DIST = "dist";

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (entry.endsWith(".md")) {
      const dest = join(DIST, relative(SRC, full));
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(full, dest);
      process.stdout.write(`copied ${dest}\n`);
    }
  }
};

walk(SRC);
