#!/usr/bin/env node
/**
 * extract_palette.js — Extracts dominant color palettes from reference images.
 * Samples colors, clusters them, and outputs JSON palettes for fish textures.
 *
 * Usage:
 *   node agents/tools/extract_palette.js --image examples/reference.png --out output/palettes/reference_palette.json
 *   node agents/tools/extract_palette.js --image examples/reference.png --region '{"x":0.3,"y":0.1,"w":0.15,"h":0.2}' --out output/palettes/angelfish_colors.json
 *   node agents/tools/extract_palette.js --all-refs   (process all reference images)
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Simple k-means color clustering
function kMeans(colors, k = 8, iterations = 20) {
  // Initialize centroids randomly
  let centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push(colors[Math.floor(Math.random() * colors.length)].slice());
  }

  let assignments = new Array(colors.length);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign each color to nearest centroid
    for (let i = 0; i < colors.length; i++) {
      let minDist = Infinity, best = 0;
      for (let j = 0; j < k; j++) {
        const d = (colors[i][0] - centroids[j][0]) ** 2 +
                  (colors[i][1] - centroids[j][1]) ** 2 +
                  (colors[i][2] - centroids[j][2]) ** 2;
        if (d < minDist) { minDist = d; best = j; }
      }
      assignments[i] = best;
    }

    // Update centroids
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]); // r, g, b, count
    for (let i = 0; i < colors.length; i++) {
      const c = assignments[i];
      sums[c][0] += colors[i][0];
      sums[c][1] += colors[i][1];
      sums[c][2] += colors[i][2];
      sums[c][3]++;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / sums[j][3]),
          Math.round(sums[j][1] / sums[j][3]),
          Math.round(sums[j][2] / sums[j][3])
        ];
      }
    }
  }

  // Count cluster sizes and sort by size
  const clusterSizes = new Array(k).fill(0);
  for (const a of assignments) clusterSizes[a]++;

  const results = centroids.map((c, i) => ({
    rgb: c,
    hex: rgbToHex(c[0], c[1], c[2]),
    hsl: rgbToHsl(c[0], c[1], c[2]),
    proportion: clusterSizes[i] / colors.length,
  })).filter(c => c.proportion > 0.01).sort((a, b) => b.proportion - a.proportion);

  return results;
}

async function extractPalette(imagePath, region = null, k = 8) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Define sample region
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (region) {
    sx = Math.floor(region.x * img.width);
    sy = Math.floor(region.y * img.height);
    sw = Math.floor(region.w * img.width);
    sh = Math.floor(region.h * img.height);
  }

  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const data = imageData.data;

  // Sample pixels (subsample for performance on large images)
  const colors = [];
  const step = Math.max(1, Math.floor(data.length / 4 / 10000)); // max 10k samples
  for (let i = 0; i < data.length; i += step * 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue; // skip transparent
    // Skip very dark (background) and very bright (highlights)
    const brightness = (r + g + b) / 3;
    if (brightness < 15 || brightness > 245) continue;
    colors.push([r, g, b]);
  }

  if (colors.length < k) {
    console.error(`Only ${colors.length} valid color samples. Need at least ${k}.`);
    return null;
  }

  const palette = kMeans(colors, k);

  // Also generate a swatch image
  const swatchH = 60;
  const swatchW = 400;
  const swatchCanvas = createCanvas(swatchW, swatchH);
  const swatchCtx = swatchCanvas.getContext('2d');
  let cx = 0;
  for (const color of palette) {
    const w = Math.max(20, Math.floor(color.proportion * swatchW));
    swatchCtx.fillStyle = color.hex;
    swatchCtx.fillRect(cx, 0, w, swatchH);
    cx += w;
  }

  return { palette, swatch: swatchCanvas };
}

// Render a palette visualization
function renderPaletteCard(palettes, outPath) {
  const cardW = 500;
  const rowH = 80;
  const canvas = createCanvas(cardW, palettes.length * rowH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  palettes.forEach((item, i) => {
    const y = i * rowH;
    // Label
    ctx.fillStyle = '#888';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(item.name, 8, y + 14);

    // Swatches
    let cx = 8;
    const swatchY = y + 22;
    for (const color of item.palette) {
      const w = Math.max(30, Math.floor(color.proportion * (cardW - 16)));
      ctx.fillStyle = color.hex;
      ctx.fillRect(cx, swatchY, w - 2, 40);
      // Hex label
      ctx.fillStyle = color.hsl.l > 50 ? '#000' : '#fff';
      ctx.font = '9px monospace';
      ctx.fillText(color.hex, cx + 3, swatchY + 25);
      cx += w;
    }
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1]; i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  fs.mkdirSync('output/palettes', { recursive: true });

  if (args['all-refs']) {
    const refs = fs.readdirSync('examples').filter(f => /\.(png|jpg|jpeg)$/i.test(f));
    const allPalettes = [];

    for (const file of refs) {
      console.log(`  Extracting: ${file}`);
      const result = await extractPalette(`examples/${file}`, null, 8);
      if (!result) continue;
      const name = file.replace(/\.(png|jpg|jpeg)$/i, '');
      const outJson = `output/palettes/${name}.json`;
      fs.writeFileSync(outJson, JSON.stringify({ source: file, palette: result.palette }, null, 2));
      allPalettes.push({ name, palette: result.palette });
      console.log(`    → ${result.palette.length} colors → ${outJson}`);
    }

    // Render combined palette card
    renderPaletteCard(allPalettes, 'output/palettes/all_palettes.png');
    console.log(`\n  Combined palette card: output/palettes/all_palettes.png`);
    return;
  }

  if (args.image) {
    const region = args.region ? JSON.parse(args.region) : null;
    const result = await extractPalette(args.image, region, parseInt(args.k || '8'));
    if (!result) return;
    const outPath = args.out || 'output/palettes/palette.json';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ source: args.image, region, palette: result.palette }, null, 2));
    // Save swatch
    const swatchPath = outPath.replace('.json', '_swatch.png');
    fs.writeFileSync(swatchPath, result.swatch.toBuffer('image/png'));
    console.log(`Palette: ${outPath} (${result.palette.length} colors)`);
    console.log(`Swatch: ${swatchPath}`);
  }
}

main().catch(console.error);
