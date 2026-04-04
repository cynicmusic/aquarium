import * as THREE from 'three';
import { createSlider, createSection, createButton } from './DesignerUtils.js';

export class EffectsDesigner {
  constructor(aquariumScene, variantGrid) {
    this.scene = aquariumScene;
    this.variantGrid = variantGrid;
  }

  render(panel) {
    // Shimmer
    const shimSection = createSection('Shimmer Particles');
    shimSection.appendChild(createSlider('Count', 50, 800, 10, this.scene.effects.params.shimmerCount, v => {
      this.scene.effects.params.shimmerCount = v;
    }));
    panel.appendChild(shimSection);

    // Glow spots
    const glowSection = createSection('Volume Glow');
    glowSection.appendChild(createSlider('Glow Spots', 0, 15, 1, this.scene.effects.params.glowCount, v => {
      this.scene.effects.params.glowCount = v;
    }));
    panel.appendChild(glowSection);

    // Bubbles
    const bubSection = createSection('Bubbles');
    const bubbles = this.scene.bubbles;
    bubSection.appendChild(createSlider('Speed', 0.5, 4, 0.1, bubbles.params.bubbleSpeed, v => {
      bubbles.params.bubbleSpeed = v;
    }));
    bubSection.appendChild(createSlider('Wobble', 0, 1, 0.01, bubbles.params.bubbleWobble, v => {
      bubbles.params.bubbleWobble = v;
    }));
    bubSection.appendChild(createSlider('Size Min', 0.01, 0.1, 0.005, bubbles.params.bubbleSizeMin, v => {
      bubbles.params.bubbleSizeMin = v;
    }));
    bubSection.appendChild(createSlider('Size Max', 0.05, 0.3, 0.005, bubbles.params.bubbleSizeMax, v => {
      bubbles.params.bubbleSizeMax = v;
    }));
    bubSection.appendChild(createSlider('Opacity', 0, 1, 0.01, bubbles.params.bubbleOpacity, v => {
      bubbles.params.bubbleOpacity = v;
      bubbles.bubbleMat.opacity = v;
    }));
    bubSection.appendChild(createSlider('Max Count', 50, 500, 10, bubbles.params.maxBubbles, v => {
      bubbles.params.maxBubbles = v;
    }));
    panel.appendChild(bubSection);

    // Actions
    const actSection = createSection('Actions');
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '6px';
    btnRow.appendChild(createButton('Regen Effects', () => {
      this.scene.effects.regenerate();
    }, true));
    btnRow.appendChild(createButton('Add Emitter', () => {
      const { tankWidth, tankDepth } = this.scene.params;
      bubbles.addEmitter(
        new THREE.Vector3(
          (Math.random() - 0.5) * tankWidth * 0.6,
          0.1 + Math.random() * 0.3,
          (Math.random() - 0.5) * tankDepth * 0.5,
        ),
        0.2 + Math.random() * 0.8,
      );
    }));
    actSection.appendChild(btnRow);
    panel.appendChild(actSection);
  }
}
