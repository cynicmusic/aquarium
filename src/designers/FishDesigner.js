import * as THREE from 'three';
import { buildCompleteFish } from '../entities/Fish3DBuilder.js';
import { createFishMaterial } from '../shaders/FishShaderMaterial.js';
// Compat shims for old API
const FISH_PRESETS = [];
const FISH_COLORS = {};
const FISH_CATEGORIES = { schooling: [], solitary: [], bottom: [], mid: [], surface: [] };
const FISH_PATTERNS = {};
function createFishMesh(type) {
  // Fallback — will be replaced properly in Phase 6
  const geo = new THREE.BoxGeometry(0.5, 0.3, 0.1);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));
  group.userData.fishType = type;
  return group;
}
import { createSection, createButton, createSelect, createTagList } from './DesignerUtils.js';

export class FishDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
    this.currentType = 'clownfish';
    this.previewMesh = null;
    this.categories = ['schooling', 'solitary', 'bottom', 'mid', 'surface'];
    this.activeCategories = [];
  }

  activate() {
    this._updatePreview();
  }

  deactivate() {
    if (this._previewGroup) {
      this.scene.scene.remove(this._previewGroup);
      this._previewGroup = null;
      this.previewMesh = null;
    }
    if (this._spinId) cancelAnimationFrame(this._spinId);
  }

  render(panel) {
    // Type selector
    const typeSection = createSection('Fish Type');
    typeSection.appendChild(createSelect('Species', Object.keys(FISH_PRESETS), this.currentType, type => {
      this.currentType = type;
      panel.innerHTML = '';
      this.render(panel);
      this._updatePreview();
    }));
    panel.appendChild(typeSection);

    // Categories
    const catSection = createSection('Categories');
    this.activeCategories = [];
    for (const [cat, types] of Object.entries(FISH_CATEGORIES)) {
      if (types.includes(this.currentType)) this.activeCategories.push(cat);
    }
    catSection.appendChild(createTagList(this.categories, this.activeCategories, (tag, active) => {
      if (active) this.activeCategories.push(tag);
      else this.activeCategories = this.activeCategories.filter(c => c !== tag);
    }));
    panel.appendChild(catSection);

    // Actions
    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';

    btnRow.appendChild(createButton('Add to Scene', () => {
      this.scene.fish.addFish(this.currentType);
    }, true));

    btnRow.appendChild(createButton('Add 5', () => {
      for (let i = 0; i < 5; i++) this.scene.fish.addFish(this.currentType);
    }));

    btnRow.appendChild(createButton('Clear All', () => {
      this.scene.fish.clearAll();
    }));

    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }

  _updatePreview() {
    if (this._previewGroup) {
      this.scene.scene.remove(this._previewGroup);
    }
    this._previewGroup = new THREE.Group();
    this.previewMesh = createFishMesh(this.currentType);
    this._previewGroup.add(this.previewMesh);

    const light1 = new THREE.PointLight(0x8080ff, 5, 10);
    light1.position.set(1, 2, 3);
    this._previewGroup.add(light1);
    const light2 = new THREE.PointLight(0xff6080, 3, 8);
    light2.position.set(-2, -1, 1);
    this._previewGroup.add(light2);

    this._previewGroup.position.set(0, 7, 5);
    this._previewGroup.scale.setScalar(3);

    if (this._spinId) cancelAnimationFrame(this._spinId);
    const group = this._previewGroup;
    const spin = () => {
      if (this._previewGroup !== group) return;
      this.previewMesh.rotation.y += 0.01;
      this._spinId = requestAnimationFrame(spin);
    };
    spin();

    this.scene.scene.add(this._previewGroup);
  }
}
