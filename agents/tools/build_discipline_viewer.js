#!/usr/bin/env node
/**
 * build_discipline_viewer.js — Builds a self-contained HTML viewer for a discipline.
 * Usage: node agents/tools/build_discipline_viewer.js --discipline fish --title "Fish" --dir output/fish
 *        node agents/tools/build_discipline_viewer.js --all
 */

import fs from 'fs';
import path from 'path';

function toBase64(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function collectPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort().map(f => ({
    name: f.replace('.png', ''),
    src: toBase64(path.join(dir, f)),
  }));
}

function buildViewer(discipline, title, baseDir) {
  const geometry = collectPngs(path.join(baseDir, 'geometry'));
  const textures = collectPngs(path.join(baseDir, 'textures'));
  const sheets = collectPngs(path.join(baseDir, 'sheets'));
  const total = geometry.length + textures.length + sheets.length;
  const ts = new Date().toLocaleString();

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${title} — Aquarium Progress</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a1a;color:#ccc;font-family:'SF Mono',monospace;padding:20px;max-width:1400px;margin:0 auto}
h1{color:#6cf;font-size:22px;margin-bottom:4px}
.meta{color:#555;font-size:11px;margin-bottom:16px}
h2{color:#f93;font-size:15px;margin:20px 0 10px;border-bottom:1px solid #2a2a4a;padding-bottom:4px}
h2 .ct{background:#2a2a4a;color:#888;font-size:10px;padding:2px 6px;border-radius:8px;margin-left:6px}
.grid{display:flex;flex-wrap:wrap;gap:10px}
.card{background:#141428;border:1px solid #2a2a4a;border-radius:6px;overflow:hidden;cursor:pointer;transition:all .15s}
.card:hover{border-color:#6cf;transform:scale(1.02)}
.card img{display:block}
.card .lb{padding:4px 8px;font-size:10px;color:#888}
.lb2{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.92);z-index:99;justify-content:center;align-items:center;flex-direction:column}
.lb2.on{display:flex}
.lb2 img{max-width:92vw;max-height:88vh}
.lb2 .cl{position:absolute;top:14px;right:22px;color:#fff;font-size:28px;cursor:pointer;opacity:.6}
.lb2 .cl:hover{opacity:1}
.lb2 .inf{color:#888;font-size:11px;margin-top:8px}
</style></head><body>
<h1>${title}</h1>
<p class="meta">${ts} — ${total} images</p>

${sheets.length ? `<h2>Contact Sheets<span class="ct">${sheets.length}</span></h2>
<div class="grid">${sheets.map(i=>`<div class="card" onclick="o('${i.name}',this.querySelector('img').src)"><img src="${i.src}" width="500"><div class="lb">${i.name}</div></div>`).join('')}</div>` : ''}

<h2>Geometry / Shapes<span class="ct">${geometry.length}</span></h2>
<div class="grid">${geometry.map(i=>`<div class="card" onclick="o('${i.name}',this.querySelector('img').src)"><img src="${i.src}" width="180"><div class="lb">${i.name}</div></div>`).join('')}</div>

${textures.length ? `<h2>Textures<span class="ct">${textures.length}</span></h2>
<div class="grid">${textures.map(i=>`<div class="card" onclick="o('${i.name}',this.querySelector('img').src)"><img src="${i.src}" width="280"><div class="lb">${i.name}</div></div>`).join('')}</div>` : ''}

<div class="lb2" id="lb"><span class="cl" onclick="c()">×</span><img id="li"><div class="inf" id="ln"></div></div>
<script>
function o(n,s){document.getElementById('li').src=s;document.getElementById('ln').textContent=n;document.getElementById('lb').classList.add('on')}
function c(){document.getElementById('lb').classList.remove('on')}
document.getElementById('lb').onclick=e=>{if(e.target.id==='lb')c()};
document.onkeydown=e=>{if(e.key==='Escape')c()};
</script></body></html>`;

  const outPath = path.join(baseDir, 'viewer.html');
  fs.writeFileSync(outPath, html);
  return outPath;
}

const DISCIPLINES = [
  { discipline: 'fish', title: '🐟 Fish (32 species)', dir: 'output/fish' },
  { discipline: 'vegetation', title: '🌿 Vegetation (32 types)', dir: 'output/vegetation' },
  { discipline: 'coral', title: '🪸 Coral (32 types)', dir: 'output/coral' },
  { discipline: 'rocks', title: '🪨 Rocks & Polyps (16+16)', dir: 'output/rocks' },
  { discipline: 'critters', title: '🦐 Critters (32 invertebrates)', dir: 'output/critters' },
  { discipline: 'cuttlefish', title: '🦑 Cuttlefish (8 species, 3 frames each)', dir: 'output/cuttlefish' },
];

const args = process.argv.slice(2);
if (args.includes('--all')) {
  for (const d of DISCIPLINES) {
    const p = buildViewer(d.discipline, d.title, d.dir);
    console.log(`✓ ${p}`);
  }
} else {
  const disc = args[args.indexOf('--discipline') + 1] || 'fish';
  const d = DISCIPLINES.find(x => x.discipline === disc) || DISCIPLINES[0];
  const p = buildViewer(d.discipline, d.title, d.dir);
  console.log(`✓ ${p}`);
}
