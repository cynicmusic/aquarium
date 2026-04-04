import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3456', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('canvas', { timeout: 10000 });

// Let the scene render for a few seconds so fish are swimming
await page.waitForTimeout(5000);

// 1. Main fish designer view
await page.click('.nav-btn[data-designer="fish"]');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-fish.png' });
console.log('Fish designer ✓');

// 2. Change to angelfish and add some
await page.selectOption('select', 'betta');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-betta.png' });
console.log('Betta fish ✓');

// 3. Cuttlefish with animated shader
await page.click('.nav-btn[data-designer="cuttlefish"]');
await page.waitForTimeout(3000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-cuttlefish.png' });
console.log('Cuttlefish ✓');

// 4. Plants designer
await page.click('.nav-btn[data-designer="plants"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/Users/asmith/aquarium/final-plants.png' });
console.log('Plants ✓');

// 5. Sand designer
await page.click('.nav-btn[data-designer="sand"]');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-sand.png' });
console.log('Sand ✓');

// 6. Lighting with different preset
await page.click('.nav-btn[data-designer="lighting"]');
await page.waitForTimeout(500);
const nightclubBtn = await page.locator('button:has-text("Nightclub")').first();
await nightclubBtn.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-lighting.png' });
console.log('Lighting nightclub ✓');

// 7. Variant grid
await page.click('.nav-btn[data-designer="fish"]');
await page.waitForTimeout(500);
await page.selectOption('select', 'lionfish');
await page.waitForTimeout(500);
const varBtn = await page.locator('button:has-text("Variants")').first();
await varBtn.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-variants.png' });
console.log('Variants ✓');

// Close variants
const closeBtn = await page.locator('#variant-grid button:has-text("Close")').first();
await closeBtn.click();
await page.waitForTimeout(300);

// 8. Full debug overlay
await page.keyboard.press('g');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-debug.png' });
console.log('Debug ✓');

// 9. Effects designer
await page.keyboard.press('g'); // toggle off debug
await page.click('.nav-btn[data-designer="effects"]');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-effects.png' });
console.log('Effects ✓');

// 10. Scene compositor
await page.click('.nav-btn[data-designer="scene"]');
await page.waitForTimeout(500);
const newEverythingBtn = await page.locator('button:has-text("New Everything")').first();
await newEverythingBtn.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: '/Users/asmith/aquarium/final-scene.png' });
console.log('Scene compositor ✓');

console.log('\nErrors:', errors.length);
errors.forEach(e => console.log('  ', e));

await browser.close();
