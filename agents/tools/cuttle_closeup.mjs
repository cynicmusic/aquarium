#!/usr/bin/env node
// Snap a close-up on the cuttlefish by injecting camera overrides via evaluateHandle.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[page error]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });

await page.goto('http://localhost:3456/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Teleport camera to frame cuttlefish — rely on global _scene (if exposed) or eval scene tree.
await page.evaluate(() => {
  // Try to find the cuttlefish via the scene graph.
  const canvas = document.querySelector('canvas');
  // The AquariumScene instance is attached to container.__aquarium in main.js? Walk globals.
  // As a fallback, look for any Object3D named "cuttlefish" via window globals.
  const aq = window.aquariumScene || window.aq || null;
  if (aq && aq.camera && aq.cuttlefish) {
    const c = aq.cuttlefish.mesh;
    aq.camera.position.set(c.position.x - 3, c.position.y + 1.5, c.position.z + 6);
    aq.camera.lookAt(c.position);
  }
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'examples/internal/cuttle_in_tank_v001.png' });
await browser.close();
console.log('wrote examples/internal/cuttle_in_tank_v001.png');
