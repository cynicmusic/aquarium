import * as THREE from 'three';
import { createSlider, createColorPicker, createSelect, createSection, createButton } from './DesignerUtils.js';

export class SandDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
  }

  render(panel) {
    const sand = this.scene.sand;

    const colorSection = createSection('Sand Colors');
    colorSection.appendChild(createColorPicker('Light', '#' + sand.params.sandColor.getHexString(), v => {
      sand.updateParams({ sandColor: new THREE.Color(v) });
    }));
    colorSection.appendChild(createColorPicker('Dark', '#' + sand.params.sandColorDark.getHexString(), v => {
      sand.updateParams({ sandColorDark: new THREE.Color(v) });
    }));
    panel.appendChild(colorSection);

    const terrainSection = createSection('Terrain');
    terrainSection.appendChild(createSlider('Dune Height', 0, 2, 0.01, sand.params.duneHeight, v => {
      sand.updateParams({ duneHeight: v });
    }));
    terrainSection.appendChild(createSlider('Dune Scale', 0.1, 3, 0.01, sand.params.duneScale, v => {
      sand.updateParams({ duneScale: v });
    }));
    terrainSection.appendChild(createSlider('Ripple Scale', 1, 20, 0.5, sand.params.rippleScale, v => {
      sand.updateParams({ rippleScale: v });
    }));
    terrainSection.appendChild(createSlider('Grain Scale', 10, 100, 1, sand.params.grainScale, v => {
      sand.updateParams({ grainScale: v });
    }));
    panel.appendChild(terrainSection);

    const textureSection = createSection('Texture Type');
    textureSection.appendChild(createSelect('Preset', ['default', 'fine', 'coarse', 'rocky'], 'default', v => {
      const idx = ['default', 'fine', 'coarse', 'rocky'].indexOf(v);
      sand.params.textureType = idx;
      // Adjust grain scale per preset
      const grainScales = [40, 80, 20, 15];
      const duneHeights = [0.8, 0.3, 1.2, 1.5];
      sand.updateParams({ grainScale: grainScales[idx], duneHeight: duneHeights[idx] });
      panel.innerHTML = '';
      this.render(panel);
    }));
    panel.appendChild(textureSection);

    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.appendChild(createButton('Variants', () => {
      this.variantGrid.show('sand', sand.params, {}, (params) => {
        sand.updateParams(params);
        panel.innerHTML = '';
        this.render(panel);
      });
    }));
    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }
}
