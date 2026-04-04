import { FishDesigner } from './FishDesigner.js';
import { CuttlefishDesigner } from './CuttlefishDesigner.js';
import { PlantDesigner } from './PlantDesigner.js';
import { SandDesigner } from './SandDesigner.js';
import { CoralDesigner } from './CoralDesigner.js';
import { LightingDesigner } from './LightingDesigner.js';
import { EffectsDesigner } from './EffectsDesigner.js';
import { SceneDesigner } from './SceneDesigner.js';

export class DesignerManager {
  constructor(panel, aquariumScene, variantGrid) {
    this.panel = panel;
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
    this.active = null;

    this.designers = {
      fish: new FishDesigner(aquariumScene, variantGrid),
      cuttlefish: new CuttlefishDesigner(aquariumScene, variantGrid),
      plants: new PlantDesigner(aquariumScene, variantGrid),
      sand: new SandDesigner(aquariumScene, variantGrid),
      coral: new CoralDesigner(aquariumScene, variantGrid),
      lighting: new LightingDesigner(aquariumScene, variantGrid),
      effects: new EffectsDesigner(aquariumScene, variantGrid),
      scene: new SceneDesigner(aquariumScene, variantGrid),
    };
  }

  switchTo(name) {
    if (this.active && this.active.deactivate) this.active.deactivate();
    this.active = this.designers[name];
    this.panel.innerHTML = '';
    if (this.active && this.active.render) {
      this.active.render(this.panel);
    }
    if (this.active && this.active.activate) this.active.activate();
  }
}
