import { AquariumScene } from './core/Scene.js';
import { DebugOverlay } from './core/Debug.js';
import { DesignerManager } from './designers/DesignerManager.js';
import { VariantGrid } from './designers/VariantGrid.js';
import * as THREE from 'three';

// Preset themes
const PRESETS = {
  reefDay: {
    bgTop: '#1a4488', bgMid: '#1060a0', bgBot: '#0a3060',
    fogColor: 0x1060a0, fogDensity: 0.012,
    ambientColor: 0x6699cc, ambientIntensity: 0.7,
    hemiTop: 0x88bbee, hemiBottom: 0x446655, hemiIntensity: 0.9,
    keyColor: 0xffeedd, keyIntensity: 1.5,
    hueRange: { min: 180, max: 280 },
    exposure: 1.4,
  },
  deepNight: {
    bgTop: '#020108', bgMid: '#08051a', bgBot: '#010005',
    fogColor: 0x050310, fogDensity: 0.008,
    ambientColor: 0x223366, ambientIntensity: 0.4,
    hemiTop: 0x2244aa, hemiBottom: 0x110822, hemiIntensity: 0.5,
    keyColor: 0x8899cc, keyIntensity: 1.0,
    hueRange: { min: 250, max: 330 },
    exposure: 1.2,
  },
};

function applyPreset(scene, presetName) {
  const p = PRESETS[presetName];
  if (!p) return;

  // Update background gradient
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, p.bgTop);
  grd.addColorStop(0.5, p.bgMid);
  grd.addColorStop(1, p.bgBot);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 2, 512);
  scene.bgPlane.material.map = new THREE.CanvasTexture(canvas);
  scene.bgPlane.material.map.needsUpdate = true;
  scene.bgPlane.material.needsUpdate = true;
  scene.scene.background = new THREE.Color(p.bgBot);

  // Fog
  scene.scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);

  // Lighting
  const lighting = scene.lighting;
  lighting.ambient.color.set(p.ambientColor);
  lighting.ambient.intensity = p.ambientIntensity;
  lighting.hemi.color.set(p.hemiTop);
  lighting.hemi.groundColor.set(p.hemiBottom);
  lighting.hemi.intensity = p.hemiIntensity;
  if (lighting.keyLight) {
    lighting.keyLight.color.set(p.keyColor);
    lighting.keyLight.intensity = p.keyIntensity;
  }
  lighting.params.hueRange = { ...p.hueRange };
  lighting.regenerate();

  // Tone mapping exposure
  scene.renderer.toneMappingExposure = p.exposure;
}

const aquariumScene = new AquariumScene(document.getElementById('canvas-container'));

if (aquariumScene._dead) {
  document.getElementById('ui-root').style.display = 'none';
} else {
  const debug = new DebugOverlay(document.getElementById('debug-overlay'), aquariumScene);
  const variantGrid = new VariantGrid(document.getElementById('variant-grid'), aquariumScene);
  const designers = new DesignerManager(document.getElementById('designer-panel'), aquariumScene, variantGrid);

  // Panel toggle (right side designer)
  const uiRoot = document.getElementById('ui-root');
  const panelToggle = document.getElementById('panel-toggle');
  panelToggle.addEventListener('click', () => {
    const isCollapsed = uiRoot.classList.toggle('collapsed');
    panelToggle.innerHTML = isCollapsed ? '&#9654;' : '&#9664;';
    panelToggle.classList.toggle('open', !isCollapsed);
  });

  // Debug panel toggle (left side)
  const debugToggleBtn = document.getElementById('debug-panel-toggle');
  let debugVisible = false;
  debugToggleBtn.addEventListener('click', () => {
    debugVisible = !debugVisible;
    debug.visible = !debug.visible;
    debug.toggle(); // this double-toggles, so set visible first
    debug.toggle();
    if (debugVisible) {
      debug.visible = false;
      debug.toggle();
    } else {
      debug.visible = true;
      debug.toggle();
    }
  });

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Open panel if collapsed
      uiRoot.classList.remove('collapsed');
      panelToggle.innerHTML = '&#9664;';
      panelToggle.classList.add('open');
      document.getElementById('designer-panel').style.display = '';
      designers.switchTo(btn.dataset.designer);
    });
  });


  // Debug toggle (G key)
  document.addEventListener('keydown', e => {
    if (e.key === 'g' || e.key === 'G') {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      debug.toggle();
      document.getElementById('debug-toggle').classList.toggle('active');
    }
  });
  document.getElementById('debug-toggle').addEventListener('click', () => {
    debug.toggle();
    document.getElementById('debug-toggle').classList.toggle('active');
  });

  // Start — apply Reef Day preset by default, no debug overlay
  aquariumScene.start();
  applyPreset(aquariumScene, 'deepNight');
}
