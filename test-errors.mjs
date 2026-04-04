import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: ['--enable-webgl', '--no-sandbox', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const allLogs = [];
page.on('console', msg => {
  const loc = msg.location();
  allLogs.push(`[${msg.type()}] ${msg.text()} (${loc.url}:${loc.lineNumber})`);
});
page.on('pageerror', err => {
  allLogs.push(`PAGEERROR: ${err.message}\n${err.stack}`);
});
page.on('response', res => {
  if (res.status() >= 400) {
    allLogs.push(`HTTP ${res.status()}: ${res.url()}`);
  }
});

await page.goto('http://localhost:3456', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(8000);

// Check DOM state
const domState = await page.evaluate(() => {
  return {
    canvasCount: document.querySelectorAll('canvas').length,
    panelChildren: document.getElementById('designer-panel')?.children.length || 0,
    bodyChildren: document.body.children.length,
    containerChildren: document.getElementById('canvas-container')?.children.length || 0,
  };
});
console.log('DOM state:', JSON.stringify(domState));

console.log('\n=== ALL LOGS ===');
allLogs.forEach(l => console.log(l));

await browser.close();
