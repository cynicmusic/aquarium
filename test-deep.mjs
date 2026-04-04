import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:3456', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForSelector('canvas', { timeout: 10000 });
await page.waitForTimeout(2000);

// ============ Test 1: Fish exist and are moving ============
console.log('\n=== TEST 1: Fish System ===');
const fishTest = await page.evaluate(() => {
  const scene = window.__aquariumScene; // need to expose this
  return { exposed: !!scene };
});

// We need to expose the scene for testing. Let me check if fish are in the Three.js scene
const sceneInfo = await page.evaluate(() => {
  // Find the Three.js renderer by looking for canvas
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  // We can't directly access the scene, so let's test via the UI
  return { canvasExists: true, width: canvas.width, height: canvas.height };
});
console.log('Canvas:', JSON.stringify(sceneInfo));

// ============ Test 2: Fish Designer Interactions ============
console.log('\n=== TEST 2: Fish Designer ===');
await page.click('.nav-btn[data-designer="fish"]');
await page.waitForTimeout(500);

// Check sliders exist
const sliderCount = await page.$$eval('input[type="range"]', els => els.length);
console.log(`Fish designer sliders: ${sliderCount}`);

// Check color pickers
const colorCount = await page.$$eval('input[type="color"]', els => els.length);
console.log(`Fish designer color pickers: ${colorCount}`);

// Check select exists
const selectVal = await page.$eval('select', el => el.value);
console.log(`Selected fish type: ${selectVal}`);

// Try changing fish type
await page.selectOption('select', 'angelfish');
await page.waitForTimeout(500);
const newSliderCount = await page.$$eval('input[type="range"]', els => els.length);
console.log(`After type change, sliders: ${newSliderCount}`);

// Move a slider
const sliders = await page.$$('input[type="range"]');
if (sliders.length > 0) {
  const slider = sliders[0];
  const box = await slider.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.waitForTimeout(300);
  console.log('Slider interaction: OK');
}

// Click Add to Scene
const addBtn = await page.locator('button:has-text("Add to Scene")').first();
if (addBtn) {
  await addBtn.click();
  await page.waitForTimeout(500);
  console.log('Add to Scene clicked: OK');
}

// Click Randomize
const randBtn = await page.locator('button:has-text("Randomize")').first();
if (randBtn) {
  await randBtn.click();
  await page.waitForTimeout(500);
  console.log('Randomize clicked: OK');
}

// Test Variants button
const varBtn = await page.locator('button:has-text("Variants")').first();
if (varBtn) {
  await varBtn.click();
  await page.waitForTimeout(1500);
  const gridVisible = await page.evaluate(() => {
    const grid = document.getElementById('variant-grid');
    return grid ? !grid.classList.contains('hidden') : false;
  });
  console.log(`Variant grid visible: ${gridVisible}`);

  const cellCount = await page.$$eval('.variant-cell', els => els.length);
  console.log(`Variant cells: ${cellCount}`);

  const canvasCount = await page.$$eval('.variant-cell canvas', els => els.length);
  console.log(`Variant canvases: ${canvasCount}`);

  // Screenshot the variant grid
  await page.screenshot({ path: '/Users/asmith/aquarium/screenshot-variants.png' });

  // Click a cell
  if (cellCount > 0) {
    await page.click('.variant-cell:nth-child(3)');
    await page.waitForTimeout(300);
    const selected = await page.$eval('.variant-cell:nth-child(3)', el => el.classList.contains('selected'));
    console.log(`Cell selection works: ${selected}`);
  }

  // Close grid
  const closeBtn = await page.locator('#variant-grid button:has-text("Close")').first();
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(300);
  }
}

// ============ Test 3: Cuttlefish Designer ============
console.log('\n=== TEST 3: Cuttlefish Designer ===');
await page.click('.nav-btn[data-designer="cuttlefish"]');
await page.waitForTimeout(1000);

const cuttleSliders = await page.$$eval('input[type="range"]', els => els.length);
const cuttleColors = await page.$$eval('input[type="color"]', els => els.length);
console.log(`Cuttlefish sliders: ${cuttleSliders}, color pickers: ${cuttleColors}`);

// Test preset buttons
const camoBtn = await page.locator('button:has-text("Camouflage")').first();
if (camoBtn) {
  await camoBtn.click();
  await page.waitForTimeout(500);
  console.log('Camouflage preset: OK');
}

const displayBtn = await page.locator('button:has-text("Display")').first();
if (displayBtn) {
  await displayBtn.click();
  await page.waitForTimeout(500);
  console.log('Display preset: OK');
}

await page.screenshot({ path: '/Users/asmith/aquarium/screenshot-cuttlefish.png' });

// ============ Test 4: All other designers ============
console.log('\n=== TEST 4: All Designers ===');
for (const name of ['plants', 'sand', 'coral', 'lighting', 'effects', 'scene']) {
  await page.click(`.nav-btn[data-designer="${name}"]`);
  await page.waitForTimeout(500);
  const children = await page.evaluate(() => document.getElementById('designer-panel').children.length);
  const errCount = errors.length;
  console.log(`${name}: ${children} sections, errors: ${errors.length - errCount > 0 ? errors.slice(errCount).join(', ') : 'none'}`);
}

// ============ Test 5: Scene compositor ============
console.log('\n=== TEST 5: Scene Compositor ===');
await page.click('.nav-btn[data-designer="scene"]');
await page.waitForTimeout(300);

const compositorBtns = ['New Fish', 'New Lighting', 'New Plants', 'New Coral', 'New Effects', 'New Everything'];
for (const label of compositorBtns) {
  const btn = await page.locator(`button:has-text("${label}")`).first();
  if (btn) {
    await btn.click();
    await page.waitForTimeout(500);
    console.log(`${label}: OK`);
  } else {
    console.log(`${label}: MISSING`);
  }
}

// ============ Test 6: Debug overlay ============
console.log('\n=== TEST 6: Debug Overlay ===');
await page.keyboard.press('g');
await page.waitForTimeout(500);
const debugSections = await page.$$eval('.debug-section', els => els.length);
console.log(`Debug sections: ${debugSections}`);

await page.screenshot({ path: '/Users/asmith/aquarium/screenshot-debug.png' });

// ============ Test 7: Camera controls ============
console.log('\n=== TEST 7: Camera Controls ===');
// Drag to orbit
const canvas = await page.$('canvas');
const cBox = await canvas.boundingBox();
await page.mouse.move(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
await page.mouse.down();
await page.mouse.move(cBox.x + cBox.width / 2 + 100, cBox.y + cBox.height / 2, { steps: 10 });
await page.mouse.up();
console.log('Camera orbit: OK');

// Scroll to zoom
await page.mouse.wheel(0, -200);
await page.waitForTimeout(300);
console.log('Camera zoom: OK');

// Final screenshot
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/asmith/aquarium/screenshot-final.png' });

// ============ Summary ============
console.log('\n=== FINAL SUMMARY ===');
console.log(`Total errors: ${errors.length}`);
errors.forEach(e => console.log('  ERR:', e));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
