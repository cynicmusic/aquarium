import * as THREE from 'three';
import { CORAL_PRESETS } from '../environment/CoralSystem.js';
import { createSlider, createColorPicker, createSelect, createSection, createButton } from './DesignerUtils.js';

export class CoralDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
    this.currentType = 'brainCoral';
  }

  render(panel) {
    const typeSection = createSection('Coral Type');
    typeSection.appendChild(createSelect('Base', Object.keys(CORAL_PRESETS), this.currentType, type => {
      this.currentType = type;
      panel.innerHTML = '';
      this.render(panel);
    }));
    panel.appendChild(typeSection);

    const preset = CORAL_PRESETS[this.currentType];

    const shapeSection = createSection('Shape');
    shapeSection.appendChild(createSlider('Size', 0.1, 3, 0.1, preset.size, v => { preset.size = v; }));
    shapeSection.appendChild(createSlider('Roughness', 0, 1, 0.01, preset.roughness, v => { preset.roughness = v; }));
    shapeSection.appendChild(createSlider('Bump', 0, 1, 0.01, preset.bumpScale, v => { preset.bumpScale = v; }));
    panel.appendChild(shapeSection);

    const colorSection = createSection('Color');
    colorSection.appendChild(createColorPicker('Color', preset.color, v => { preset.color = v; }));
    panel.appendChild(colorSection);

    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.appendChild(createButton('Add Coral', () => {
      const { tankWidth, tankDepth } = this.scene.params;
      this.scene.coral.addCoral(this.currentType, new THREE.Vector3(
        (Math.random() - 0.5) * tankWidth * 0.8,
        0,
        (Math.random() - 0.5) * tankDepth * 0.6,
      ));
    }, true));
    btnRow.appendChild(createButton('Clear All', () => this.scene.coral.clearAll()));
    btnRow.appendChild(createButton('Randomize', () => {
      this.scene.coral.clearAll();
      this.scene.coral._spawnDefaults();
    }));
    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }
}
