/**
 * CuttlefishSheet.js — 4×4 grid with COUPLED axes so every tile is clearly
 * different.
 *
 * Row = body morphotype (length, radius, height, taper move together)
 * Col = activity posture (armCurl, tentacleExtension, fin amp, zebra fade coupled)
 */

import * as THREE from 'three';
import { createCuttlefish, updateCuttlefish } from '../entities/Cuttlefish.js';

const grid = document.getElementById('grid');

const ROWS = [
  { mantleLength: 1.10, mantleRadius: 0.48, mantleHeight: 0.18, mantleTaper: 0.30, label: 'stout'      },
  { mantleLength: 1.60, mantleRadius: 0.42, mantleHeight: 0.22, mantleTaper: 0.55, label: 'standard'   },
  { mantleLength: 2.30, mantleRadius: 0.40, mantleHeight: 0.22, mantleTaper: 0.90, label: 'elongated'  },
  { mantleLength: 3.00, mantleRadius: 0.34, mantleHeight: 0.18, mantleTaper: 1.40, label: 'eel-like'   },
];

const COLS = [
  { armCurl: 0.10, tentacleExtension: 0.00, finRippleAmp: 0.020, zebraIntensity: 1.00, chromaIntensity: 0.50, label: 'calm'     },
  { armCurl: 0.45, tentacleExtension: 0.25, finRippleAmp: 0.045, zebraIntensity: 0.75, chromaIntensity: 0.70, label: 'drifting' },
  { armCurl: 0.85, tentacleExtension: 0.60, finRippleAmp: 0.065, zebraIntensity: 0.40, chromaIntensity: 0.90, label: 'alert'    },
  { armCurl: 1.00, tentacleExtension: 1.00, finRippleAmp: 0.090, zebraIntensity: 0.10, chromaIntensity: 1.05, label: 'striking' },
];

const variants = [];
for (let r = 0; r < 4; r++)
  for (let c = 0; c < 4; c++)
    variants.push({ ...ROWS[r], ...COLS[c], label: `${ROWS[r].label} / ${COLS[c].label}` });

const renderers = [];
for (const v of variants) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const canvas = document.createElement('canvas');
  const lbl = document.createElement('div');
  lbl.className = 'lbl';
  lbl.innerHTML = `<b>${v.label}</b><br>L${v.mantleLength.toFixed(1)} H${v.mantleHeight.toFixed(2)}<br>c${v.armCurl.toFixed(2)} t${v.tentacleExtension.toFixed(2)}`;
  cell.appendChild(canvas);
  cell.appendChild(lbl);
  grid.appendChild(cell);

  const W = 420, H = 340;
  canvas.width = W; canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x07080f);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);
  camera.position.set(3.2, 0.9, 3.6);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0x334466, 0.8));
  const key = new THREE.DirectionalLight(0xffeedd, 1.3);
  key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6688bb, 0.7);
  rim.position.set(-4, 2, -3); scene.add(rim);

  const cuttle = createCuttlefish({
    mantleLength:      v.mantleLength,
    mantleRadius:      v.mantleRadius,
    mantleHeight:      v.mantleHeight,
    mantleTaper:       v.mantleTaper,
    armCurl:           v.armCurl,
    tentacleExtension: v.tentacleExtension,
    finRippleAmp:      v.finRippleAmp,
    zebraIntensity:    v.zebraIntensity,
    chromaIntensity:   v.chromaIntensity,
  });
  scene.add(cuttle);
  renderers.push({ renderer, scene, camera, cuttle });
}

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const t = clock.getElapsedTime();
  for (const { renderer, scene, camera, cuttle } of renderers) {
    cuttle.rotation.y = 0.35 + Math.sin(t * 0.2) * 0.25;
    updateCuttlefish(cuttle, t);
    renderer.render(scene, camera);
  }
}
loop();
