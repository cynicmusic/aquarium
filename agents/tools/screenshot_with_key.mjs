#!/usr/bin/env node
/** Screenshot a URL after pressing a key to toggle debug rendering. */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const url = arg('url', '/');
const out = arg('out', 'examples/internal/snap.png');
const key = arg('key', 'd');

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:3456' + url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.keyboard.press(key);
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
