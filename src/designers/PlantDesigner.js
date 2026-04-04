import * as THREE from 'three';
import { PLANT_PRESETS } from '../environment/PlantSystem.js';
import { createSlider, createColorPicker, createSelect, createSection, createButton } from './DesignerUtils.js';

export class PlantDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
    this.currentType = 'seaGrass';
  }

  render(panel) {
    const typeSection = createSection('Plant Type');
    typeSection.appendChild(createSelect('Base', Object.keys(PLANT_PRESETS), this.currentType, type => {
      this.currentType = type;
      panel.innerHTML = '';
      this.render(panel);
    }));
    panel.appendChild(typeSection);

    const preset = PLANT_PRESETS[this.currentType];

    const shapeSection = createSection('Shape');
    shapeSection.appendChild(createSlider('Height', 0.1, 6, 0.1, preset.height, v => { preset.height = v; }));
    shapeSection.appendChild(createSlider('Width', 0.01, 1, 0.01, preset.width, v => { preset.width = v; }));
    shapeSection.appendChild(createSlider('Blades', 1, 25, 1, preset.bladeCount, v => { preset.bladeCount = v; }));
    panel.appendChild(shapeSection);

    const animSection = createSection('Animation');
    animSection.appendChild(createSlider('Sway Amount', 0, 1, 0.01, preset.swayAmount, v => {
      preset.swayAmount = v;
      this.scene.plants.plants.forEach(p => {
        if (p.type === this.currentType) p.material.uniforms.uSwayAmount.value = v;
      });
    }));
    animSection.appendChild(createSlider('Sway Speed', 0.1, 4, 0.1, preset.swaySpeed, v => {
      preset.swaySpeed = v;
      this.scene.plants.plants.forEach(p => {
        if (p.type === this.currentType) p.material.uniforms.uSwaySpeed.value = v;
      });
    }));
    animSection.appendChild(createSlider('Current', 0, 1, 0.01, this.scene.plants.params.currentStrength, v => {
      this.scene.plants.params.currentStrength = v;
    }));
    panel.appendChild(animSection);

    const colorSection = createSection('Colors');
    colorSection.appendChild(createColorPicker('Base', preset.color, v => { preset.color = v; }));
    colorSection.appendChild(createColorPicker('Tip', preset.colorTip, v => { preset.colorTip = v; }));
    colorSection.appendChild(createSlider('Translucency', 0, 1, 0.01, preset.translucency, v => { preset.translucency = v; }));
    panel.appendChild(colorSection);

    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.appendChild(createButton('Add Plant', () => {
      const { tankWidth, tankDepth } = this.scene.params;
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * tankWidth * 0.8,
        0,
        (Math.random() - 0.5) * tankDepth * 0.6,
      );
      this.scene.plants.addPlant(this.currentType, pos);
    }, true));
    btnRow.appendChild(createButton('Clear Plants', () => {
      this.scene.plants.clearAll();
    }));
    btnRow.appendChild(createButton('Randomize All', () => {
      this.scene.plants.clearAll();
      this.scene.plants._spawnDefaults();
    }));
    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }
}
