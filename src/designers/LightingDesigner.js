import * as THREE from 'three';
import { createSlider, createColorPicker, createSection, createButton } from './DesignerUtils.js';

export class LightingDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
  }

  render(panel) {
    const lighting = this.scene.lighting;

    const ambientSection = createSection('Ambient');
    ambientSection.appendChild(createSlider('Intensity', 0, 0.3, 0.005, lighting.params.ambientIntensity, v => {
      lighting.params.ambientIntensity = v;
      lighting.ambient.intensity = v;
    }));
    panel.appendChild(ambientSection);

    const beamSection = createSection('Light Beams');
    beamSection.appendChild(createSlider('Count', 1, 12, 1, lighting.params.beamCount, v => {
      lighting.params.beamCount = v;
    }));
    beamSection.appendChild(createSlider('Hue Min', 0, 360, 1, lighting.params.hueRange.min, v => {
      lighting.params.hueRange.min = v;
    }));
    beamSection.appendChild(createSlider('Hue Max', 0, 360, 1, lighting.params.hueRange.max, v => {
      lighting.params.hueRange.max = v;
    }));

    const hueLabel = document.createElement('div');
    hueLabel.style.cssText = 'color:#505870;font-size:10px;margin-top:-2px;margin-bottom:8px;padding-left:88px';
    hueLabel.textContent = '0=red 60=yellow 120=green 180=cyan 240=blue 300=purple';
    beamSection.appendChild(hueLabel);

    panel.appendChild(beamSection);

    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.appendChild(createButton('Regenerate', () => {
      lighting.regenerate();
    }, true));
    btnRow.appendChild(createButton('Warm', () => {
      lighting.params.hueRange = { min: 0, max: 40 };
      lighting.regenerate();
      panel.innerHTML = '';
      this.render(panel);
    }));
    btnRow.appendChild(createButton('Cool', () => {
      lighting.params.hueRange = { min: 200, max: 280 };
      lighting.regenerate();
      panel.innerHTML = '';
      this.render(panel);
    }));
    btnRow.appendChild(createButton('Nightclub', () => {
      lighting.params.hueRange = { min: 260, max: 340 };
      lighting.params.beamCount = 8;
      lighting.regenerate();
      panel.innerHTML = '';
      this.render(panel);
    }));
    actSection.appendChild(btnRow);
    panel.appendChild(actSection);

    // Water effects
    const waterSection = createSection('Water Caustics');
    const water = this.scene.water;
    waterSection.appendChild(createSlider('Intensity', 0, 3, 0.01, water.params.causticIntensity, v => {
      water.params.causticIntensity = v;
      water.causticMaterial.uniforms.uCausticIntensity.value = v;
    }));
    waterSection.appendChild(createSlider('Scale', 1, 10, 0.1, water.params.causticScale, v => {
      water.params.causticScale = v;
      water.causticMaterial.uniforms.uCausticScale.value = v;
    }));
    waterSection.appendChild(createSlider('Refraction', 0, 3, 0.01, water.params.refractionDistortion, v => {
      water.params.refractionDistortion = v;
      water.refractionMaterial.uniforms.uDistortion.value = v;
    }));
    panel.appendChild(waterSection);
  }
}
