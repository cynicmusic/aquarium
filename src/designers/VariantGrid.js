import * as THREE from 'three';
// Legacy compat — VariantGrid will be updated in full designer overhaul
const createFishMesh = (type) => {
  const geo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
  const g = new THREE.Group(); g.add(new THREE.Mesh(geo, mat)); g.userData.fishType = type; return g;
};
import { createButton } from './DesignerUtils.js';

/**
 * 4x4 variant grid — shows 16 variations of current design.
 * Labels: A1-A4, B1-B4, C1-C4, D1-D4
 * User picks favorites, they become the new current.
 */
export class VariantGrid {
  constructor(element, aquariumScene) {
    this.el = element;
    this.scene = aquariumScene;
    this.cells = [];
    this.renderers = [];
    this.variants = [];
    this.onSelect = null;
    this.type = null;
    this.selected = -1;
  }

  show(type, baseParams, baseColors, onSelect) {
    this.type = type;
    this.onSelect = onSelect;
    this.selected = -1;
    this.el.classList.remove('hidden');

    // Clear
    this.el.innerHTML = '';
    this._cleanup();

    // Header — separate from the grid cells
    const header = document.createElement('div');
    header.className = 'grid-header';
    header.innerHTML = `<span>Variants — ${type} — click to select, double-click to apply</span>`;

    const applyBtn = createButton('Apply Selected', () => {
      if (this.selected >= 0) {
        const v = this.variants[this.selected];
        this.onSelect(v.params, v.colors);
        this.hide();
      }
    }, true);

    const closeBtn = createButton('Close', () => this.hide());
    const regenBtn = createButton('Regenerate', () => {
      this._generateVariants(type, baseParams, baseColors);
      this._renderAll();
    });

    header.append(regenBtn, applyBtn, closeBtn);

    // Grid container for cells only
    const gridContainer = document.createElement('div');
    gridContainer.className = 'grid-cells';

    // Generate 16 variants
    this._generateVariants(type, baseParams, baseColors);

    // Create cells
    const labels = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        labels.push(String.fromCharCode(65 + r) + (c + 1));
      }
    }

    labels.forEach((label, i) => {
      const cell = document.createElement('div');
      cell.className = 'variant-cell';

      const lbl = document.createElement('div');
      lbl.className = 'variant-label';
      lbl.textContent = label;

      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;

      cell.appendChild(canvas);
      cell.appendChild(lbl);

      cell.addEventListener('click', () => {
        gridContainer.querySelectorAll('.variant-cell').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this.selected = i;
      });

      cell.addEventListener('dblclick', () => {
        if (this.onSelect) {
          const v = this.variants[i];
          this.onSelect(v.params, v.colors);
          this.hide();
        }
      });

      gridContainer.appendChild(cell);
      this.cells.push({ cell, canvas, label });
    });

    this.el.appendChild(header);
    this.el.appendChild(gridContainer);

    this._renderAll();
  }

  hide() {
    this.el.classList.add('hidden');
    this._cleanup();
  }

  _cleanup() {
    this.renderers.forEach(r => {
      r.renderer.dispose();
      cancelAnimationFrame(r.animId);
    });
    this.renderers = [];
    this.cells = [];
  }

  _generateVariants(type, baseParams, baseColors) {
    this.variants = [];
    for (let i = 0; i < 16; i++) {
      const params = { ...baseParams };
      const colors = { ...baseColors };

      // Each variant mutates differently
      const mutationStrength = 0.15 + (i / 16) * 0.35; // variants get progressively wilder

      // Mutate shape params
      for (const key of Object.keys(params)) {
        const v = params[key];
        if (typeof v === 'number') {
          params[key] = v * (1 + (Math.random() - 0.5) * 2 * mutationStrength);
          params[key] = Math.max(0.01, params[key]);
        }
      }

      // Mutate colors — shift hue/saturation
      if (i > 0) {
        colors.primary = this._mutateColor(baseColors.primary, mutationStrength * 0.5);
        colors.secondary = this._mutateColor(baseColors.secondary, mutationStrength * 0.3);
        colors.accent = this._mutateColor(baseColors.accent, mutationStrength * 0.2);
      }

      this.variants.push({ params, colors });
    }
  }

  _mutateColor(hexColor, amount) {
    const c = new THREE.Color(hexColor);
    const hsl = {};
    c.getHSL(hsl);
    hsl.h += (Math.random() - 0.5) * amount;
    hsl.s = Math.max(0, Math.min(1, hsl.s + (Math.random() - 0.5) * amount));
    hsl.l = Math.max(0.05, Math.min(0.95, hsl.l + (Math.random() - 0.5) * amount * 0.5));
    c.setHSL(hsl.h, hsl.s, hsl.l);
    return '#' + c.getHexString();
  }

  _renderAll() {
    this.renderers.forEach(r => {
      r.renderer.dispose();
      cancelAnimationFrame(r.animId);
    });
    this.renderers = [];

    this.cells.forEach((cell, i) => {
      const variant = this.variants[i];
      if (!variant) return;

      const renderer = new THREE.WebGLRenderer({
        canvas: cell.canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(300, 300);
      renderer.setClearColor(0x0a0a1a, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0e1e);
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      camera.position.set(0, 0.2, 2.5);
      camera.lookAt(0, 0, 0);

      // Stronger lighting so fish/objects are clearly visible
      scene.add(new THREE.AmbientLight(0x4050a0, 1.0));
      const dl = new THREE.DirectionalLight(0x8080ff, 2.5);
      dl.position.set(2, 4, 3);
      scene.add(dl);
      const dl2 = new THREE.DirectionalLight(0xc060a0, 1.0);
      dl2.position.set(-2, 2, -1);
      scene.add(dl2);
      // Rim light
      const dl3 = new THREE.DirectionalLight(0x4080ff, 0.8);
      dl3.position.set(0, -1, 2);
      scene.add(dl3);

      // Fish mesh
      let mesh;
      if (this.type === 'fish' && variant.fishType) {
        mesh = createFishMesh(variant.fishType);
      } else if (this.type === 'fish') {
        mesh = createFishMesh(variant.params, variant.colors);
      } else {
        // Placeholder for other types
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.5),
          new THREE.MeshStandardMaterial({ color: variant.colors?.primary || '#ff6600' })
        );
      }
      scene.add(mesh);

      // Animate
      let animId;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        mesh.rotation.y += 0.015;
        renderer.render(scene, camera);
      };
      animate();

      this.renderers.push({ renderer, animId });
    });
  }
}
