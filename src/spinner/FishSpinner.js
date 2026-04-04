/**
 * FishSpinner.js — POC page: 32 fish spinning in 3D with layer tuning sliders.
 * Entry point for fish-spinner.html
 */

import * as THREE from 'three';
import { buildCompleteFish, loadAllSpecies } from '../entities/Fish3DBuilder.js';
import { createFishMaterial, updateLayerUniforms } from '../shaders/FishShaderMaterial.js';

const COLS = 8;
const CELL_SIZE = 6.0;  // spacing between fish in world units

let renderer, camera, scene, clock;
let fishEntries = [];    // { root, material, spinRate, label }
let allMaterials = [];   // all fish materials for batch uniform updates
let spinSpeedMult = 0.5;

async function init() {
  const viewport = document.getElementById('viewport');
  const status = document.getElementById('status');

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.setClearColor(0x0a0a1a);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  viewport.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  // Camera — slight angle from above like the user's preferred view
  const aspect = viewport.clientWidth / viewport.clientHeight;
  camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 200);
  camera.position.set(0, 18, 52);
  camera.lookAt(0, -4, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0x667788, 0.8);
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(5, 8, 10);
  const fill = new THREE.DirectionalLight(0x88aacc, 0.5);
  fill.position.set(-3, -2, 5);
  const back = new THREE.DirectionalLight(0x556677, 0.3);
  back.position.set(0, 0, -5);
  scene.add(ambient, key, fill, back);

  // Load species data
  status.textContent = 'Loading species data...';
  let speciesMap;
  try {
    speciesMap = await loadAllSpecies('/fish/');
  } catch (e) {
    status.textContent = 'Error loading fish data. Run: node agents/tools/naca_fish.js --export-3d';
    console.error(e);
    return;
  }

  status.textContent = `Building ${speciesMap.size} fish...`;

  // Build each fish
  const names = [...speciesMap.keys()];
  const rows = Math.ceil(names.length / COLS);
  const gridW = (COLS - 1) * CELL_SIZE;
  const gridH = (rows - 1) * CELL_SIZE;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const data = speciesMap.get(name);
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    try {
      const fish = buildCompleteFish(data, { widthFactor: 0.55 });
      const material = createFishMaterial(data.pattern, data.colors);

      // Single body mesh
      const bodyMesh = new THREE.Mesh(fish.bodyGeo, material);
      fish.root.add(bodyMesh);

      // Position in grid
      // Offset left to compensate for right sidebar
      const x = col * CELL_SIZE - gridW / 2 - 2.5;
      const y = -(row * CELL_SIZE - gridH / 2);
      fish.root.position.set(x, y, 0);

      // Scale to fit cell — big fish
      fish.root.scale.setScalar(5.0);

      scene.add(fish.root);

      const spinRate = 0.3 + Math.random() * 0.4;
      fishEntries.push({ root: fish.root, material, spinRate, name });
      allMaterials.push(material);

      // Add name label as HTML overlay (simpler than sprite)
    } catch (e) {
      console.warn(`Failed to build ${name}:`, e);
    }
  }

  status.textContent = `${fishEntries.length} fish loaded. Drag sliders to tune layers.`;

  // Wire up sliders
  setupSliders();

  // Handle resize
  window.addEventListener('resize', () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  // Start render loop
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Spin each fish at its own rate
  for (const entry of fishEntries) {
    entry.root.rotation.y = elapsed * entry.spinRate * spinSpeedMult;
  }

  renderer.render(scene, camera);
}

function setupSliders() {
  const bind = (id, uniformKey, scale = 1, isInt = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    const valSpan = el.parentElement?.querySelector('.val');

    const update = () => {
      let v = parseFloat(el.value) * scale;
      if (isInt) v = parseInt(el.value);
      if (valSpan) valSpan.textContent = isInt ? v : v.toFixed(2);
      const params = {};
      params[uniformKey] = v;
      for (const mat of allMaterials) {
        updateLayerUniforms(mat, params);
      }
    };
    el.addEventListener('input', update);
  };

  // Scales
  bind('scaleSize', 'scaleSize', 1);
  bind('scaleOpacity', 'scaleOpacity', 0.01);
  bind('scaleContrast', 'scaleContrast', 0.01);

  // Depth
  bind('depthOpacity', 'depthOpacity', 0.01);
  bind('depthNoiseOffset', 'depthNoiseOffset', 0.1);
  bind('depthFreqScale', 'depthFreqScale', 0.01);

  // Depth blend mode (select)
  const blendSelect = document.getElementById('depthBlendMode');
  if (blendSelect) {
    blendSelect.addEventListener('change', () => {
      const v = parseInt(blendSelect.value);
      for (const mat of allMaterials) {
        updateLayerUniforms(mat, { depthBlendMode: v });
      }
    });
  }

  // Iridescence
  bind('iridIntensity', 'iridIntensity', 0.01);
  bind('iridAngleShift', 'iridAngleShift', 0.01);

  // Iridescence colors
  const bindColor = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const params = {};
      params[key] = el.value;
      for (const mat of allMaterials) {
        updateLayerUniforms(mat, params);
      }
    });
  };
  bindColor('iridColor1', 'iridColor1');
  bindColor('iridColor2', 'iridColor2');

  // Global spin speed
  const spinEl = document.getElementById('spinSpeed');
  if (spinEl) {
    const valSpan = spinEl.parentElement?.querySelector('.val');
    spinEl.addEventListener('input', () => {
      spinSpeedMult = parseFloat(spinEl.value) * 0.01;
      if (valSpan) valSpan.textContent = spinSpeedMult.toFixed(2);
    });
  }

  // Width factor (requires rebuild — skip for now, just log)
  const widthEl = document.getElementById('widthFactor');
  if (widthEl) {
    const valSpan = widthEl.parentElement?.querySelector('.val');
    widthEl.addEventListener('input', () => {
      const v = parseFloat(widthEl.value) * 0.01;
      if (valSpan) valSpan.textContent = v.toFixed(2);
      // TODO: rebuild fish with new width factor
    });
  }
}

init();
