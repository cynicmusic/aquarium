import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--ignore-gpu-blocklist',
  ],
});

const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

try {
  await page.goto('http://localhost:3456', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  // Wait for scene to render and fish to start pacing
  await page.waitForTimeout(3000);

  // Screenshot the main scene (Deep Night preset - default)
  await page.screenshot({ path: 'iteration-default.png', fullPage: false });
  console.log('Screenshot 1: default (deep night) taken');

  // Take a second screenshot after more time for fish movement
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'iteration-5s.png', fullPage: false });
  console.log('Screenshot 2: 5s later taken');

  if (errors.length > 0) {
    console.log('\n--- Console Errors ---');
    errors.forEach(e => console.log(e));
  } else {
    console.log('No errors detected');
  }

} catch (e) {
  console.error('Test failed:', e.message);
  await page.screenshot({ path: 'iteration-error.png', fullPage: false });
  if (errors.length > 0) {
    console.log('\n--- Console Errors ---');
    errors.forEach(e => console.log(e));
  }
}

await browser.close();
