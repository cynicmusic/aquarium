#!/usr/bin/env node
/**
 * baseline_screenshots.mjs — capture current state of the three live views
 * so we have a before/after record for the iteration cycle.
 *
 * Output: examples/internal/baseline_<timestamp>/
 *   - aquarium.png      (main scene)
 *   - workshop.png      (chromatophore workshop)
 *   - spinner.png       (fish spinner)
 *   - notes.md          (auto-generated metadata)
 *
 * Assumes vite is running on :3456 (use scripts/ensure-dev.sh first).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const URL_BASE = 'http://localhost:3456';
const SIZE = { width: 1600, height: 900 };

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(ROOT, 'examples', 'internal', `baseline_${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

async function cap(page, url, filename, settleMs = 1500) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(settleMs);
  const file = path.join(outDir, filename);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  wrote', path.relative(ROOT, file));
}

// Chrome headless can't create WebGL contexts by default; enable SwiftShader.
const browser = await chromium.launch({
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});
const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
const page = await ctx.newPage();

page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });

console.log('Capturing baseline →', path.relative(ROOT, outDir));
await cap(page, `${URL_BASE}/`, 'aquarium.png', 2500);
await cap(page, `${URL_BASE}/chromatophore-workshop.html`, 'workshop.png', 2000);
await cap(page, `${URL_BASE}/fish-spinner.html`, 'spinner.png', 2000);

const notes = `# Baseline ${stamp}

Captured views
- aquarium.png — main 3D aquarium designer (/)
- workshop.png — chromatophore workshop (/chromatophore-workshop.html)
- spinner.png — fish spinner (/fish-spinner.html)

Viewport: ${SIZE.width}×${SIZE.height} @ 2x DPR.
`;
fs.writeFileSync(path.join(outDir, 'notes.md'), notes);

await browser.close();
console.log('done →', path.relative(ROOT, outDir));
