#!/usr/bin/env node
/**
 * render_contact_sheet.js — Assembles multiple PNG files into a labeled grid.
 *
 * Usage:
 *   node agents/tools/render_contact_sheet.js --dir output/sprites/textures/ --pattern "tex_*.png" --out output/sheets/sheet_001_textures.png --cols 4
 *   node agents/tools/render_contact_sheet.js --files "tex_001.png,tex_002.png,tex_003.png" --out output/sheets/sheet_002.png
 */

import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      parsed[args[i].slice(2)] = args[i + 1] || true;
      i++;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const cols = parseInt(args.cols || '4');
  const tileSize = parseInt(args.tileSize || '256');
  const labelHeight = 24;

  // Collect files
  let files = [];
  if (args.files) {
    files = args.files.split(',').map(f => f.trim());
  } else if (args.dir) {
    const dir = args.dir;
    const pattern = args.pattern ? new RegExp(args.pattern.replace(/\*/g, '.*')) : /\.png$/;
    files = fs.readdirSync(dir)
      .filter(f => pattern.test(f) && f.endsWith('.png'))
      .sort()
      .map(f => path.join(dir, f));
  }

  if (files.length === 0) {
    console.error('No files found');
    process.exit(1);
  }

  const rows = Math.ceil(files.length / cols);
  const cellH = tileSize + labelHeight;
  const canvas = createCanvas(cols * tileSize, rows * cellH);
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < files.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * tileSize;
    const y = row * cellH;

    try {
      const img = await loadImage(files[i]);
      ctx.drawImage(img, x, y, tileSize, tileSize);
    } catch (e) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x, y, tileSize, tileSize);
    }

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    const label = path.basename(files[i], '.png');
    ctx.fillText(label, x + 4, y + tileSize + 16);
  }

  const outPath = args.out || 'output/sheets/sheet.png';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Contact sheet saved to ${outPath} (${files.length} images, ${cols}x${rows} grid)`);
}

main().catch(console.error);
