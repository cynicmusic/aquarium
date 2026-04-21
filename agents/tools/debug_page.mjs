#!/usr/bin/env node
/** capture all console + errors from a URL load */
import { chromium } from 'playwright';

const url = process.argv[2] || '/cuttlefish-preview.html';
const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message, '\n', e.stack));
page.on('console', m => console.log(`[${m.type()}]`, m.text()));
page.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure()?.errorText));

await page.goto('http://localhost:3456' + url, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await browser.close();
