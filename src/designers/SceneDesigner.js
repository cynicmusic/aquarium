import { createSection, createButton } from './DesignerUtils.js';

export class SceneDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
  }

  render(panel) {
    const sceneSection = createSection('Scene Compositor');

    const desc = document.createElement('div');
    desc.style.cssText = 'color:#7080a0;font-size:11px;margin-bottom:12px;line-height:1.5';
    desc.textContent = 'Swap individual layers while keeping the rest. Generate new random configurations for fish, lighting, plants, or the full scene.';
    sceneSection.appendChild(desc);

    const btnGrid = document.createElement('div');
    btnGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px';

    btnGrid.appendChild(createButton('New Fish', () => {
      this.scene.fish.clearAll();
      this.scene.fish._spawnDefaults();
    }));

    btnGrid.appendChild(createButton('New Lighting', () => {
      this.scene.lighting.regenerate();
      this.scene.effects.regenerate();
    }));

    btnGrid.appendChild(createButton('New Plants', () => {
      this.scene.plants.clearAll();
      this.scene.plants._spawnDefaults();
    }));

    btnGrid.appendChild(createButton('New Coral', () => {
      this.scene.coral.clearAll();
      this.scene.coral._spawnDefaults();
    }));

    btnGrid.appendChild(createButton('New Effects', () => {
      this.scene.effects.regenerate();
    }));

    btnGrid.appendChild(createButton('New Everything', () => {
      this.scene.fish.clearAll();
      this.scene.fish._spawnDefaults();
      this.scene.lighting.regenerate();
      this.scene.plants.clearAll();
      this.scene.plants._spawnDefaults();
      this.scene.coral.clearAll();
      this.scene.coral._spawnDefaults();
      this.scene.effects.regenerate();
    }, true));

    sceneSection.appendChild(btnGrid);
    panel.appendChild(sceneSection);

    // Info
    const infoSection = createSection('Controls');
    const info = document.createElement('div');
    info.style.cssText = 'color:#606880;font-size:11px;line-height:1.8';
    info.innerHTML = `
      <div><b style="color:#8090b0">Mouse drag</b> — orbit camera</div>
      <div><b style="color:#8090b0">Scroll</b> — zoom in/out</div>
      <div><b style="color:#8090b0">G</b> — toggle debug overlay</div>
      <div><b style="color:#8090b0">Variant grid</b> — click to select, double-click to apply</div>
    `;
    infoSection.appendChild(info);
    panel.appendChild(infoSection);
  }
}
