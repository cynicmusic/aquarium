#!/usr/bin/env node
/**
 * build_viewer.js — Generates a self-contained HTML progress viewer with all images embedded as base64.
 * Run after generating sprites/textures to rebuild the viewer.
 *
 * Usage: node agents/tools/build_viewer.js
 * Opens: output/viewer.html
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = 'output';
const VIEWER_PATH = 'output/viewer.html';

function toBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

function collectImages(dir) {
  const images = [];
  if (!fs.existsSync(dir)) return images;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.png')) continue;
    const fullPath = path.join(dir, file);
    const jsonPath = fullPath.replace('.png', '.json');
    let params = null;
    if (fs.existsSync(jsonPath)) {
      try { params = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch(e) {}
    }
    images.push({
      name: file.replace('.png', ''),
      src: toBase64(fullPath),
      params,
      size: fs.statSync(fullPath).size,
      modified: fs.statSync(fullPath).mtime.toISOString(),
    });
  }
  return images;
}

function collectReviews(dir) {
  const reviews = [];
  if (!fs.existsSync(dir)) return reviews;
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.md')) continue;
    reviews.push({
      name: file.replace('.md', ''),
      content: fs.readFileSync(path.join(dir, file), 'utf-8'),
    });
  }
  return reviews;
}

// Collect everything
const geometry = collectImages('output/sprites/geometry');
const textures = collectImages('output/sprites/textures');
const combined = collectImages('output/sprites/combined');
const sheets = collectImages('output/sprites/sheets');
const reviews = collectReviews('agents/progress/reviews');

const timestamp = new Date().toLocaleString();
const totalImages = geometry.length + textures.length + combined.length + sheets.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>🐟 Aquarium Progress — ${timestamp}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a1a; color: #ccc; font-family: 'SF Mono', 'Consolas', 'Monaco', monospace; padding: 20px; max-width: 1400px; margin: 0 auto; }
  h1 { color: #6cf; margin-bottom: 4px; font-size: 24px; }
  .meta { color: #555; font-size: 11px; margin-bottom: 20px; }
  h2 { color: #f93; margin: 28px 0 12px; font-size: 17px; border-bottom: 1px solid #2a2a4a; padding-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  h2 .count { background: #2a2a4a; color: #888; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
  .grid { display: flex; flex-wrap: wrap; gap: 14px; }
  .card { background: #141428; border: 1px solid #2a2a4a; border-radius: 8px; overflow: hidden; cursor: pointer; transition: all 0.2s; position: relative; }
  .card:hover { border-color: #6cf; transform: scale(1.02); box-shadow: 0 4px 20px rgba(100,200,255,0.15); }
  .card img { display: block; }
  .card .label { padding: 6px 10px; font-size: 11px; color: #888; }
  .card .params { padding: 0 10px 6px; font-size: 9px; color: #555; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .section { margin-bottom: 36px; }
  .review { background: #141428; border: 1px solid #2a2a4a; border-radius: 8px; padding: 16px 20px; margin: 10px 0; font-size: 12px; line-height: 1.7; white-space: pre-wrap; font-family: inherit; }
  .review h3 { color: #6cf; font-size: 14px; margin-bottom: 8px; }
  .lightbox { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); z-index: 100; justify-content: center; align-items: center; flex-direction: column; }
  .lightbox.active { display: flex; }
  .lightbox img { max-width: 92vw; max-height: 85vh; border-radius: 4px; }
  .lightbox .info { color: #888; font-size: 12px; margin-top: 10px; }
  .lightbox .close { position: absolute; top: 16px; right: 24px; color: #fff; font-size: 32px; cursor: pointer; opacity: 0.6; }
  .lightbox .close:hover { opacity: 1; }
  .stagnation { background: #331100; border: 1px solid #664400; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; color: #fa4; font-size: 13px; }
  .stagnation strong { color: #f84; }
  .empty { color: #444; font-style: italic; padding: 12px; }
  .score-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 8px; }
  .score-low { background: #441100; color: #f84; }
  .score-mid { background: #443300; color: #fc4; }
  .score-good { background: #114400; color: #6f4; }
  .nav { position: sticky; top: 0; background: #0a0a1a; z-index: 50; padding: 10px 0; border-bottom: 1px solid #1a1a3a; margin-bottom: 20px; display: flex; gap: 16px; }
  .nav a { color: #6cf; text-decoration: none; font-size: 12px; padding: 4px 10px; border-radius: 4px; }
  .nav a:hover { background: #1a1a3a; }
</style>
</head>
<body>

<h1>🐟 Aquarium Fish — Progress Viewer</h1>
<p class="meta">Generated: ${timestamp} | ${totalImages} images | ${reviews.length} reviews</p>

<nav class="nav">
  <a href="#geometry">Geometry (${geometry.length})</a>
  <a href="#textures">Textures (${textures.length})</a>
  <a href="#sheets">Sheets (${sheets.length})</a>
  <a href="#combined">Combined (${combined.length})</a>
  <a href="#reviews">Reviews (${reviews.length})</a>
</nav>

${geometry.length >= 8 && textures.length >= 7 ? `
<div class="stagnation">
  <strong>⚠ Stagnation Check:</strong> Fish silhouettes have been through ${Math.floor(geometry.length / 8)} revision rounds,
  still at 5/10. Consider: extracting outlines from real fish photos, tracing SVG silhouettes,
  or using a fundamentally different approach to geometry (e.g. parametric super-ellipse bodies instead of hand-placed control points).
</div>
` : ''}

<div class="section" id="geometry">
  <h2>Fish Geometry <span class="count">${geometry.length} sprites</span> <span class="score-badge score-low">5.0/10</span></h2>
  ${geometry.length === 0 ? '<p class="empty">No geometry sprites yet.</p>' : ''}
  <div class="grid">
    ${geometry.map(img => `
      <div class="card" onclick="openLB('${img.name}', this.querySelector('img').src)">
        <img src="${img.src}" width="200">
        <div class="label">${img.name}</div>
        ${img.params ? `<div class="params">${img.params.species || ''} — ${img.params.controlPoints ? Object.values(img.params.controlPoints).reduce((a,b)=>a+b,0) + ' pts' : ''}</div>` : ''}
      </div>
    `).join('')}
  </div>
</div>

<div class="section" id="textures">
  <h2>Texture Sweeps <span class="count">${textures.length} sweeps</span> <span class="score-badge score-low">5.0/10</span></h2>
  ${textures.length === 0 ? '<p class="empty">No texture sweeps yet.</p>' : ''}
  <div class="grid">
    ${textures.map(img => `
      <div class="card" onclick="openLB('${img.name}', this.querySelector('img').src)">
        <img src="${img.src}" width="350">
        <div class="label">${img.name}</div>
        ${img.params ? `<div class="params">${img.params.type || ''} ${img.params.sweep ? '→ ' + img.params.sweep.param : ''}</div>` : ''}
      </div>
    `).join('')}
  </div>
</div>

<div class="section" id="sheets">
  <h2>Contact Sheets <span class="count">${sheets.length}</span></h2>
  ${sheets.length === 0 ? '<p class="empty">No contact sheets yet.</p>' : ''}
  <div class="grid">
    ${sheets.map(img => `
      <div class="card" onclick="openLB('${img.name}', this.querySelector('img').src)">
        <img src="${img.src}" width="500">
        <div class="label">${img.name}</div>
      </div>
    `).join('')}
  </div>
</div>

<div class="section" id="combined">
  <h2>Combined (Textured Fish) <span class="count">${combined.length}</span></h2>
  ${combined.length === 0 ? '<p class="empty">No combined textured fish yet. Need to reach geometry score ≥7 first.</p>' : ''}
  <div class="grid">
    ${combined.map(img => `
      <div class="card" onclick="openLB('${img.name}', this.querySelector('img').src)">
        <img src="${img.src}" width="200">
        <div class="label">${img.name}</div>
      </div>
    `).join('')}
  </div>
</div>

<div class="section" id="reviews">
  <h2>Critic Reviews <span class="count">${reviews.length}</span></h2>
  ${reviews.map(r => `
    <div class="review">
      <h3>${r.name}</h3>
      ${r.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </div>
  `).join('')}
</div>

<div class="lightbox" id="lb">
  <span class="close" onclick="closeLB()">×</span>
  <img id="lb-img">
  <div class="info" id="lb-info"></div>
</div>

<script>
function openLB(name, src) {
  document.getElementById('lb-img').src = src;
  document.getElementById('lb-info').textContent = name;
  document.getElementById('lb').classList.add('active');
}
function closeLB() { document.getElementById('lb').classList.remove('active'); }
document.getElementById('lb').addEventListener('click', e => { if (e.target.id === 'lb') closeLB(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });
</script>
</body>
</html>`;

fs.writeFileSync(VIEWER_PATH, html);
console.log(`Viewer built: ${VIEWER_PATH} (${totalImages} images, ${reviews.length} reviews)`);
console.log(`Open with: open ${VIEWER_PATH}`);
