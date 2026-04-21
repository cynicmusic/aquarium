#!/usr/bin/env node
/**
 * cuttle_multiview.mjs — render the cuttlefish preview from 4 angles and
 * composite into a single image (side, front, top, 3/4). Gives the critic
 * multi-view to evaluate head shape / eye position.
 *
 * Uses a query-string to orient the camera; the preview page listens for
 * ?yaw=…&pitch=…&hideTentacles=1 params.
 */

import { chromium } from 'playwright';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const OUT = arg('out', 'examples/internal/cuttle_multiview.png');

const VIEWS = [
  { label: 'SIDE',  yaw: 0.0,              pitch: 0.0 },
  { label: 'FRONT', yaw: Math.PI / 2,      pitch: 0.0 },
  { label: 'TOP',   yaw: 0.0,              pitch: -1.2 },
  { label: '3/4',   yaw: Math.PI / 4,      pitch: -0.35 },
];

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));

const shots = [];
for (const view of VIEWS) {
  const url = `http://localhost:3456/cuttlefish-preview.html?yaw=${view.yaw}&pitch=${view.pitch}&hideTentacles=1&autoRotate=0`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const buf = await page.screenshot({ fullPage: false });
  shots.push({ label: view.label, buf });
  console.log(`  captured ${view.label}`);
}
await browser.close();

// Composite
const COLS = 4;
const TILE_W = 720;
const TILE_H = 540;
const PAD = 8;
const LABEL_H = 30;
const out = createCanvas(COLS * (TILE_W + PAD) + PAD, TILE_H + LABEL_H + PAD * 2);
const c = out.getContext('2d');
c.fillStyle = '#07080f';
c.fillRect(0, 0, out.width, out.height);

for (let i = 0; i < shots.length; i++) {
  const x = PAD + i * (TILE_W + PAD);
  c.fillStyle = '#7bd';
  c.font = 'bold 16px monospace';
  c.fillText(shots[i].label, x + 6, PAD + 20);
  const img = await loadImage(shots[i].buf);
  const scale = Math.min(TILE_W / img.width, TILE_H / img.height);
  const w = img.width * scale, h = img.height * scale;
  c.drawImage(img, x + (TILE_W - w) / 2, LABEL_H + PAD + (TILE_H - h) / 2, w, h);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.toBuffer('image/png'));
console.log('wrote', OUT);
