/**
 * SkinSheet.js — renders 16 UV-plane tiles using the chromatophore shader.
 * 4 rows × 4 cols = 16 variants. Each cell is a flat quad with the live
 * ChromatophoreMaterial so the full animation runs.
 */

import * as THREE from 'three';
import { createChromatophoreMaterial } from '../shaders/ChromatophoreMaterial.js';

const grid = document.getElementById('grid');

const ROW_ZEBRA = [
  { zebraIntensity: 0.0,  zebraFrequency: 6,  label: 'zebra off' },
  { zebraIntensity: 0.6,  zebraFrequency: 6,  label: 'z0.6 f6'   },
  { zebraIntensity: 0.85, zebraFrequency: 11, label: 'z0.85 f11' },
  { zebraIntensity: 1.0,  zebraFrequency: 16, label: 'z1.0 f16'  },
];
const COL_IRID = [
  { iridoIntensity: 0.15, chromaDensity: 26, label: 'irid0.15 d26' },
  { iridoIntensity: 0.55, chromaDensity: 46, label: 'irid0.55 d46' },
  { iridoIntensity: 0.9,  chromaDensity: 68, label: 'irid0.9 d68'  },
  { iridoIntensity: 1.4,  chromaDensity: 92, label: 'irid1.4 d92' },
];

const mats = [];
for (let r = 0; r < 4; r++) {
  for (let c = 0; c < 4; c++) {
    const row = ROW_ZEBRA[r];
    const col = COL_IRID[c];
    const label = `${row.label} × ${col.label}`;

    const cell = document.createElement('div');
    cell.className = 'cell';
    const canvas = document.createElement('canvas');
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = `<b>${r}${c}</b> ${label}`;
    cell.appendChild(canvas);
    cell.appendChild(lbl);
    grid.appendChild(cell);

    const W = 600, H = 400;
    canvas.width = W; canvas.height = H;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x07080f);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 0.66, -0.66, -1, 1);

    // Flat quad with UVs that span [0,1]
    const geo = new THREE.PlaneGeometry(2, 1.33, 1, 1);
    const mat = createChromatophoreMaterial({
      chromaDensity:   col.chromaDensity,
      chromaIntensity: 0.95,
      iridoIntensity:  col.iridoIntensity,
      iridoHueRange:   1.0,
      zebraIntensity:  row.zebraIntensity,
      zebraFrequency:  row.zebraFrequency,
      leukoTint:       '#e1d5c2',
      skinTint:        '#ffffff',
      lightingBias:    0.1,
    });
    mats.push(mat);

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    // Cache renderer+scene+camera for loop
    cell._rsc = { renderer, scene, camera, mat };
  }
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  for (const mat of mats) mat.uniforms.uTime.value = t;
  for (const cell of grid.children) {
    const { renderer, scene, camera } = cell._rsc;
    renderer.render(scene, camera);
  }
}
loop();
