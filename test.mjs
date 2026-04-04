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
const page = await browser.newPage();

const errors = [];
const warnings = [];
const logs = [];

page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error') errors.push(text);
  else if (msg.type() === 'warning') warnings.push(text);
  else logs.push(text);
});

page.on('pageerror', err => {
  errors.push(err.message);
});

console.log('Loading page...');
await page.goto('http://localhost:3456', { waitUntil: 'networkidle', timeout: 15000 });
console.log('Page loaded, waiting for render...');

// Wait for canvas to appear
await page.waitForSelector('canvas', { timeout: 10000 }).catch(() => {
  errors.push('No canvas element found after 10s');
});

// Wait a bit for animations/shaders to compile
await page.waitForTimeout(3000);

// Check if WebGL context is alive
const glInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { error: 'no webgl context' };
  return {
    renderer: gl.getParameter(gl.RENDERER),
    vendor: gl.getParameter(gl.VENDOR),
    width: canvas.width,
    height: canvas.height,
  };
});
console.log('WebGL:', JSON.stringify(glInfo));

// Check designer panel rendered
const panelContent = await page.evaluate(() => {
  const panel = document.getElementById('designer-panel');
  return panel ? { hasContent: panel.children.length > 0, html: panel.innerHTML.substring(0, 500) } : { error: 'no panel' };
});
console.log('Panel:', JSON.stringify(panelContent));

// Check all nav buttons work
const navButtons = await page.$$('.nav-btn');
console.log(`Nav buttons found: ${navButtons.length}`);
for (const btn of navButtons) {
  const name = await btn.getAttribute('data-designer');
  await btn.click();
  await page.waitForTimeout(500);
  const content = await page.evaluate(() => {
    const p = document.getElementById('designer-panel');
    return p ? p.children.length : 0;
  });
  console.log(`  ${name}: ${content} children`);
  // Check for new errors after clicking
  if (errors.length > 0) {
    console.log(`  ERROR after clicking ${name}:`, errors[errors.length - 1]);
  }
}

// Try debug overlay toggle
await page.keyboard.press('g');
await page.waitForTimeout(500);
const debugVisible = await page.evaluate(() => {
  const d = document.getElementById('debug-overlay');
  return d ? !d.classList.contains('hidden') : false;
});
console.log('Debug overlay visible after G:', debugVisible);

// Screenshot
await page.screenshot({ path: '/Users/asmith/aquarium/screenshot.png', fullPage: false });
console.log('Screenshot saved to screenshot.png');

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Errors: ${errors.length}`);
errors.forEach(e => console.log('  ERR:', e));
console.log(`Warnings: ${warnings.length}`);
warnings.forEach(w => console.log('  WARN:', w));
console.log(`Logs: ${logs.length}`);

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
