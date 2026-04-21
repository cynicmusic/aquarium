#!/usr/bin/env node
/**
 * screenshot_url.mjs — snap a single URL at a given viewport size into a PNG.
 *
 * Usage:
 *   node agents/tools/screenshot_url.mjs --url /cuttlefish-preview.html --out examples/internal/cuttle_v1.png
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };

const url = arg('url', '/');
const out = arg('out', `examples/internal/snap_${Date.now()}.png`);
const width  = +arg('w', '1600');
const height = +arg('h', '900');
const wait   = +arg('wait', '2500');
const base   = arg('base', 'http://localhost:3456');

fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });

await page.goto(base + url, { waitUntil: 'networkidle' });
await page.waitForTimeout(wait);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('wrote', out);
