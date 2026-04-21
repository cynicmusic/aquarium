#!/usr/bin/env node
/**
 * swim_endurance.mjs — verify the world doesn't "run out" over a long swim.
 * Enters swim mode without a cfg (uses new baked defaults) and screenshots
 * at 10s, 30s, 60s, 90s, 120s to confirm floor + flora keep populating.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'examples/internal/swim_endurance';
const base = 'http://localhost:3456';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Use a clean localStorage state so we test the baked HTML defaults
const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });

await page.goto(base + '/cuttlefish-preview.html', { waitUntil: 'networkidle' });
// Clear localStorage just for this tab's session so we get HTML defaults
await page.evaluate(() => localStorage.removeItem('cuttle.preview.params.v1'));
await page.reload({ waitUntil: 'networkidle' });
// Swim mode boots on by default now — just wait for it to settle
await page.waitForTimeout(1200);

// Pick a stable variant (endurance test needs consistent framing)
await page.click('#cam4');

const samples = [
  { t: 8,  name: '008s' },
  { t: 30, name: '030s' },
  { t: 60, name: '060s' },
  { t: 90, name: '090s' },
  { t: 120, name: '120s' },
];
let waited = 0;
for (const s of samples) {
  await page.waitForTimeout((s.t - waited) * 1000);
  waited = s.t;
  const out = path.join(OUT_DIR, `${s.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log('wrote', out);
}

await browser.close();
