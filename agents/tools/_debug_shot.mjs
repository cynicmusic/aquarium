import { chromium } from 'playwright';
import fs from 'fs';
const b = await chromium.launch({ args: ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
// Default orientation — no cfg, no yaw, no pitch
await p.goto('http://localhost:3456/cuttlefish-preview.html?autoRotate=0', { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
fs.writeFileSync('/Users/asmith/aquarium/agents/progress/debug_default.png', await p.screenshot({ fullPage: false }));
await b.close();
console.log('wrote debug_default.png');
