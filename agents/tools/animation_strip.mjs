#!/usr/bin/env node
/**
 * animation_strip.mjs — captures N frames from a URL spaced over time and
 * composites them into a single horizontal strip so we can see motion.
 *
 *   node animation_strip.mjs --url /cuttlefish-preview.html --out examples/internal/cuttle_anim_strip.png --frames 4 --gap 1500
 */

import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

const url    = arg('url', '/');
const out    = arg('out', 'examples/internal/anim_strip.png');
const frames = +arg('frames', '4');
const gap    = +arg('gap', '1500');
const width  = +arg('w', '900');
const height = +arg('h', '600');
const warm   = +arg('warm', '2500');
const base   = arg('base', 'http://localhost:3456');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.mkdirSync('/tmp/anim_strip', { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });

await page.goto(base + url, { waitUntil: 'networkidle' });
await page.waitForTimeout(warm);

const framePaths = [];
for (let i = 0; i < frames; i++) {
  if (i > 0) await page.waitForTimeout(gap);
  const fp = `/tmp/anim_strip/frame_${i}.png`;
  await page.screenshot({ path: fp, fullPage: false });
  framePaths.push(fp);
  console.log(`  frame ${i} captured`);
}
await browser.close();

// Stitch horizontally with timestamps
const first = await loadImage(framePaths[0]);
const fw = first.width;
const fh = first.height;
const LABEL_H = 26;
const PAD = 4;
const strip = createCanvas(fw * frames + PAD * (frames + 1), fh + LABEL_H + PAD * 2);
const c = strip.getContext('2d');
c.fillStyle = '#05060a';
c.fillRect(0, 0, strip.width, strip.height);

for (let i = 0; i < frames; i++) {
  const img = await loadImage(framePaths[i]);
  const x = PAD + i * (fw + PAD);
  c.drawImage(img, x, PAD);
  c.fillStyle = '#9ab';
  c.font = 'bold 14px monospace';
  c.fillText(`t ≈ ${(warm + i * gap) / 1000}s`, x + 8, strip.height - 8);
}
fs.writeFileSync(out, strip.toBuffer('image/png'));
console.log('wrote', out);
