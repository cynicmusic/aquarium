#!/usr/bin/env node
/**
 * render_texture_tile.js — Renders a procedural texture to PNG for visual inspection.
 *
 * Usage:
 *   node agents/tools/render_texture_tile.js --type scales --params '{"octaves":4,"lacunarity":2.0,"gain":0.5,"scale":15,"ridgeSharpness":0.5,"warp":0.1}' --out output/sprites/textures/tex_001_scales.png
 *   node agents/tools/render_texture_tile.js --type spots --params '{"cellSize":0.08,"jitter":0.7,"edgeSoftness":0.3,"sizeVariation":0.4,"density":0.5}' --out output/sprites/textures/tex_002_spots.png
 *   node agents/tools/render_texture_tile.js --type stripes --params '{"frequency":8,"wobble":0.2,"thickness":0.4,"fadeEdge":0.3,"angle":5}' --out output/sprites/textures/tex_003_stripes.png
 *   node agents/tools/render_texture_tile.js --type composite --params '{"scales":{...},"spots":{...},"stripes":{...},"colors":["#ff6b35","#fff"]}' --out output/sprites/textures/tex_004_composite.png
 *   node agents/tools/render_texture_tile.js --batch batch_config.json  (generate many at once)
 *
 * Also supports --sweep to generate a grid exploring one parameter:
 *   node agents/tools/render_texture_tile.js --type scales --sweep '{"param":"octaves","values":[1,2,3,4,5,6,7,8]}' --base '{"lacunarity":2.0,"gain":0.5,"scale":15}' --out output/sprites/textures/sweep_octaves.png
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const SIZE = 512;

// ── Noise primitives ──

function hash(x, y, seed = 0) {
  let h = (x + seed * 17) * 374761393 + (y + seed * 31) * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy, seed), n10 = hash(ix + 1, iy, seed);
  const n01 = hash(ix, iy + 1, seed), n11 = hash(ix + 1, iy + 1, seed);
  return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
}

function perlin(x, y, opts = {}) {
  const { octaves = 4, lacunarity = 2.0, gain = 0.5, seed = 0 } = opts;
  let val = 0, amp = 1, freq = 1, totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 100) * amp;
    totalAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return val / totalAmp;
}

// Gradient noise (better than value noise for organic textures)
function gradientNoise(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  // Quintic interpolation (smoother than cubic)
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  // Pseudo-random gradients
  const grad = (hx, hy) => {
    const h = hash(hx, hy, seed);
    const angle = h * Math.PI * 2;
    return { gx: Math.cos(angle), gy: Math.sin(angle) };
  };

  const dot = (hx, hy, dx, dy) => {
    const g = grad(hx, hy);
    return g.gx * dx + g.gy * dy;
  };

  const n00 = dot(ix, iy, fx, fy);
  const n10 = dot(ix + 1, iy, fx - 1, fy);
  const n01 = dot(ix, iy + 1, fx, fy - 1);
  const n11 = dot(ix + 1, iy + 1, fx - 1, fy - 1);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return (nx0 + (nx1 - nx0) * sy) * 0.5 + 0.5; // normalize to 0-1
}

function fbm(x, y, opts = {}) {
  const { octaves = 4, lacunarity = 2.0, gain = 0.5, seed = 0 } = opts;
  let val = 0, amp = 1, freq = 1, totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += gradientNoise(x * freq, y * freq, seed + i * 100) * amp;
    totalAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return val / totalAmp;
}

// Ridge noise for sharp features (scale edges)
function ridgeNoise(x, y, opts = {}) {
  const { octaves = 4, lacunarity = 2.0, gain = 0.5, seed = 0, sharpness = 1.0 } = opts;
  let val = 0, amp = 1, freq = 1, totalAmp = 0;
  for (let i = 0; i < octaves; i++) {
    let n = gradientNoise(x * freq, y * freq, seed + i * 100);
    n = 1.0 - Math.abs(n * 2 - 1); // create ridges
    n = Math.pow(n, 1.0 + sharpness); // sharpen
    val += n * amp;
    totalAmp += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return val / totalAmp;
}

// Voronoi / Worley noise for spots and cells
function voronoi(x, y, opts = {}) {
  const { jitter = 1.0, seed = 0 } = opts;
  const ix = Math.floor(x), iy = Math.floor(y);
  let minDist = 999, secondDist = 999;
  let closestX = 0, closestY = 0;

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cx = ix + dx + hash(ix + dx, iy + dy, seed) * jitter;
      const cy = iy + dy + hash(ix + dx, iy + dy, seed + 50) * jitter;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < minDist) {
        secondDist = minDist;
        minDist = dist;
        closestX = cx;
        closestY = cy;
      } else if (dist < secondDist) {
        secondDist = dist;
      }
    }
  }
  return { f1: minDist, f2: secondDist, edge: secondDist - minDist, cx: closestX, cy: closestY };
}

// ── Texture generators ──

function generateScales(ctx, w, h, params) {
  const {
    octaves = 4, lacunarity = 2.0, gain = 0.5, scale = 15,
    ridgeSharpness = 0.5, warp = 0.1, seed = 42,
    baseColor = [180, 140, 100], highlightColor = [220, 200, 180]
  } = params;

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      let nx = (px / w) * scale;
      let ny = (py / h) * scale;

      // Domain warping for organic distortion
      if (warp > 0) {
        const wx = fbm(nx + 5.2, ny + 1.3, { octaves: 2, seed }) * warp * scale;
        const wy = fbm(nx + 1.7, ny + 9.2, { octaves: 2, seed: seed + 10 }) * warp * scale;
        nx += wx;
        ny += wy;
      }

      // Scale pattern: combination of ridge noise and voronoi
      const ridge = ridgeNoise(nx, ny, { octaves, lacunarity, gain, seed, sharpness: ridgeSharpness });
      const v = voronoi(nx * 0.8, ny * 0.8, { jitter: 0.8, seed });
      const scaleEdge = Math.pow(Math.max(0, 1 - v.edge * 3), 2);

      // Combine
      const combined = ridge * 0.6 + scaleEdge * 0.4;

      // Color
      const t = combined;
      data[idx]     = Math.round(baseColor[0] + (highlightColor[0] - baseColor[0]) * t);
      data[idx + 1] = Math.round(baseColor[1] + (highlightColor[1] - baseColor[1]) * t);
      data[idx + 2] = Math.round(baseColor[2] + (highlightColor[2] - baseColor[2]) * t);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function generateSpots(ctx, w, h, params) {
  const {
    cellSize = 0.08, jitter = 0.7, edgeSoftness = 0.3,
    sizeVariation = 0.4, density = 0.5, seed = 42,
    spotColor = [40, 30, 20], baseColor = [200, 160, 100]
  } = params;

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  const cellScale = 1.0 / cellSize;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      const nx = (px / w) * cellScale;
      const ny = (py / h) * cellScale;

      const v = voronoi(nx, ny, { jitter, seed });

      // Spot size varies per cell
      const cellHash = hash(Math.floor(v.cx), Math.floor(v.cy), seed + 77);
      const spotRadius = (0.3 + cellHash * sizeVariation) * (1.0 / cellScale);

      // Whether this cell has a spot (density control)
      const hasSpot = hash(Math.floor(v.cx), Math.floor(v.cy), seed + 99) < density;

      let spotVal = 0;
      if (hasSpot) {
        const distNorm = v.f1 / (spotRadius * cellScale);
        if (edgeSoftness > 0) {
          spotVal = 1.0 - Math.min(1, Math.pow(distNorm, 1.0 / edgeSoftness));
        } else {
          spotVal = distNorm < 1.0 ? 1.0 : 0.0;
        }
      }

      const t = Math.max(0, Math.min(1, spotVal));
      data[idx]     = Math.round(baseColor[0] + (spotColor[0] - baseColor[0]) * t);
      data[idx + 1] = Math.round(baseColor[1] + (spotColor[1] - baseColor[1]) * t);
      data[idx + 2] = Math.round(baseColor[2] + (spotColor[2] - baseColor[2]) * t);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function generateStripes(ctx, w, h, params) {
  const {
    frequency = 8, wobble = 0.2, thickness = 0.4,
    fadeEdge = 0.3, angle = 0, seed = 42,
    stripeColor = [20, 20, 40], baseColor = [220, 200, 160]
  } = params;

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  const rad = angle * Math.PI / 180;
  const cosA = Math.cos(rad), sinA = Math.sin(rad);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = (py * w + px) * 4;
      const nx = px / w, ny = py / h;

      // Rotate coordinates
      const rx = nx * cosA - ny * sinA;
      const ry = nx * sinA + ny * cosA;

      // Add wobble via noise
      const wobbleOffset = wobble > 0 ? fbm(rx * 3, ry * 3, { octaves: 2, seed }) * wobble : 0;

      // Stripe pattern
      const stripePos = (ry + wobbleOffset) * frequency;
      const stripeFrac = stripePos - Math.floor(stripePos);

      let stripeVal;
      if (fadeEdge > 0) {
        const dist = Math.abs(stripeFrac - 0.5) * 2; // 0 at center, 1 at edge
        stripeVal = dist < thickness ?
          Math.min(1, (thickness - dist) / fadeEdge) : 0;
      } else {
        stripeVal = stripeFrac < thickness ? 1.0 : 0.0;
      }

      const t = Math.max(0, Math.min(1, stripeVal));
      data[idx]     = Math.round(baseColor[0] + (stripeColor[0] - baseColor[0]) * t);
      data[idx + 1] = Math.round(baseColor[1] + (stripeColor[1] - baseColor[1]) * t);
      data[idx + 2] = Math.round(baseColor[2] + (stripeColor[2] - baseColor[2]) * t);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function generateComposite(ctx, w, h, params) {
  const {
    scales = null, spots = null, stripes = null,
    colors = ['#ff6b35', '#ffffff', '#1a1a2e'],
    blendMode = 'multiply'
  } = params;

  // Start with base color
  const baseRGB = hexToRGB(colors[0] || '#808080');
  ctx.fillStyle = colors[0] || '#808080';
  ctx.fillRect(0, 0, w, h);

  // Layer each texture type
  const tmpCanvas = createCanvas(w, h);
  const tmpCtx = tmpCanvas.getContext('2d');

  if (scales) {
    generateScales(tmpCtx, w, h, { ...scales, baseColor: baseRGB, highlightColor: hexToRGB(colors[1] || '#ffffff') });
    ctx.globalCompositeOperation = blendMode;
    ctx.globalAlpha = scales.opacity || 0.6;
    ctx.drawImage(tmpCanvas, 0, 0);
  }

  if (spots) {
    tmpCtx.clearRect(0, 0, w, h);
    generateSpots(tmpCtx, w, h, { ...spots, baseColor: [128, 128, 128], spotColor: hexToRGB(colors[2] || '#1a1a2e') });
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = spots.opacity || 0.5;
    ctx.drawImage(tmpCanvas, 0, 0);
  }

  if (stripes) {
    tmpCtx.clearRect(0, 0, w, h);
    generateStripes(tmpCtx, w, h, { ...stripes, baseColor: [200, 200, 200], stripeColor: hexToRGB(colors[2] || '#1a1a2e') });
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = stripes.opacity || 0.5;
    ctx.drawImage(tmpCanvas, 0, 0);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

// ── Sweep mode: generate a grid exploring one parameter ──

function generateSweep(params, baseParams, type) {
  const { param, values } = params;
  const cols = Math.ceil(Math.sqrt(values.length));
  const rows = Math.ceil(values.length / cols);
  const tileSize = SIZE;
  const canvas = createCanvas(cols * tileSize, rows * tileSize);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const generators = { scales: generateScales, spots: generateSpots, stripes: generateStripes, composite: generateComposite };
  const gen = generators[type];

  values.forEach((val, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const tileCanvas = createCanvas(tileSize, tileSize);
    const tileCtx = tileCanvas.getContext('2d');

    const tileParams = { ...baseParams, [param]: val };
    gen(tileCtx, tileSize, tileSize, tileParams);

    ctx.drawImage(tileCanvas, col * tileSize, row * tileSize);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${param}=${val}`, col * tileSize + 8, row * tileSize + 22);
  });

  return canvas;
}

// ── CLI ──

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      parsed[key] = args[i + 1] || true;
      i++;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();

  // Batch mode
  if (args.batch) {
    const batchConfig = JSON.parse(fs.readFileSync(args.batch, 'utf-8'));
    for (const item of batchConfig) {
      const canvas = createCanvas(SIZE, SIZE);
      const ctx = canvas.getContext('2d');
      const generators = { scales: generateScales, spots: generateSpots, stripes: generateStripes, composite: generateComposite };
      generators[item.type](ctx, SIZE, SIZE, item.params);

      const dir = path.dirname(item.out);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(item.out, canvas.toBuffer('image/png'));
      fs.writeFileSync(item.out.replace('.png', '.json'), JSON.stringify({ type: item.type, params: item.params }, null, 2));
      console.log(`  ✓ ${item.out}`);
    }
    return;
  }

  const type = args.type || 'scales';
  const outPath = args.out || `output/sprites/textures/tex_${type}.png`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Sweep mode
  if (args.sweep) {
    const sweepParams = JSON.parse(args.sweep);
    const baseParams = args.base ? JSON.parse(args.base) : {};
    const canvas = generateSweep(sweepParams, baseParams, type);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({ type, sweep: sweepParams, base: baseParams }, null, 2));
    console.log(`Sweep saved to ${outPath}`);
    return;
  }

  // Single tile mode
  const params = args.params ? JSON.parse(args.params) : {};
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  const generators = { scales: generateScales, spots: generateSpots, stripes: generateStripes, composite: generateComposite };
  const gen = generators[type];
  if (!gen) {
    console.error(`Unknown type: ${type}. Available: scales, spots, stripes, composite`);
    process.exit(1);
  }

  gen(ctx, SIZE, SIZE, params);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  fs.writeFileSync(outPath.replace('.png', '.json'), JSON.stringify({ type, params }, null, 2));
  console.log(`Texture saved to ${outPath}`);
}

main().catch(console.error);
