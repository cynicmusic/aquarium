import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-setuid-sandbox','--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
await page.goto('http://localhost:3456', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);
console.log('Errors:', errors.length ? errors.join('\n') : 'none');
await page.screenshot({ path: 'iteration-error-check.png' });
await browser.close();
