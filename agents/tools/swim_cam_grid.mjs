#!/usr/bin/env node
/**
 * swim_cam_grid.mjs — snapshot all 8 swim camera variants.
 * Swim mode now boots on by default; just click each cam in turn.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'examples/internal/swim_cams';
const base = 'http://localhost:3456';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));

await page.goto(base + '/cuttlefish-preview.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  await page.click('#cam' + n);
  await page.waitForTimeout(3500);
  const out = path.join(OUT_DIR, `cam${n}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log('wrote', out);
}

await browser.close();
