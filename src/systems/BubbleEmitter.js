import * as THREE from 'three';

export class BubbleEmitter {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.emitters = [];
    this.bubbles = [];
    this.params = {
      maxBubbles: 60,
      bubbleSpeed: 1.5,
      bubbleWobble: 0.3,
      bubbleSizeMin: 0.03,
      bubbleSizeMax: 0.12,
      bubbleOpacity: 0.3,
    };

    // Shared bubble geometry + material
    this.bubbleGeo = new THREE.SphereGeometry(1, 8, 6);
    this.bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x80a0e0,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: this.params.bubbleOpacity,
      envMapIntensity: 2.0,
    });

    this._createDefaultEmitters();
  }

  _createDefaultEmitters() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;

    // A few emitter points
    // Spread emitters across the whole tank floor
    const positions = [];
    for (let i = 0; i < 8; i++) {
      positions.push(new THREE.Vector3(
        (Math.random() - 0.5) * tankWidth * 0.9,
        0.1 + Math.random() * 0.15,
        (Math.random() - 0.5) * tankDepth * 0.7,
      ));
    }

    positions.forEach(pos => {
      this.addEmitter(pos, 0.3 + Math.random() * 0.5);
    });
  }

  addEmitter(position, frequency = 0.5) {
    const emitter = {
      position: position.clone(),
      frequency, // bubbles per second
      timer: 0,
    };
    this.emitters.push(emitter);
    return emitter;
  }

  removeEmitter(emitter) {
    this.emitters = this.emitters.filter(e => e !== emitter);
  }

  _spawnBubble(emitter) {
    if (this.bubbles.length >= this.params.maxBubbles) return;

    const size = this.params.bubbleSizeMin + Math.random() * (this.params.bubbleSizeMax - this.params.bubbleSizeMin);
    const mesh = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
    mesh.scale.setScalar(size);
    mesh.position.copy(emitter.position);
    mesh.position.x += (Math.random() - 0.5) * 0.3;
    mesh.position.z += (Math.random() - 0.5) * 0.3;

    this.aquariumScene.scene.add(mesh);
    this.bubbles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        this.params.bubbleSpeed * (0.7 + Math.random() * 0.6),
        (Math.random() - 0.5) * 0.2,
      ),
      age: 0,
      wobblePhase: Math.random() * Math.PI * 2,
    });
  }

  update(dt) {
    const { tankHeight } = this.aquariumScene.params;

    // Emit
    for (const emitter of this.emitters) {
      emitter.timer += dt;
      const interval = 1.0 / emitter.frequency;
      while (emitter.timer >= interval) {
        emitter.timer -= interval;
        this._spawnBubble(emitter);
      }
    }

    // Update bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.wobblePhase += dt * 3.0;

      // Wobble
      b.mesh.position.x += Math.sin(b.wobblePhase) * this.params.bubbleWobble * dt;
      b.mesh.position.z += Math.cos(b.wobblePhase * 0.7) * this.params.bubbleWobble * dt * 0.5;

      // Rise
      b.mesh.position.addScaledVector(b.velocity, dt);

      // Slow down slightly as they rise
      b.velocity.y *= 0.999;

      // Remove if above tank
      if (b.mesh.position.y > tankHeight + 1) {
        this.aquariumScene.scene.remove(b.mesh);
        this.bubbles.splice(i, 1);
      }
    }
  }

  getDebugInfo() {
    return {
      name: 'Bubbles',
      params: {
        activeBubbles: this.bubbles.length,
        maxBubbles: this.params.maxBubbles,
        emitters: this.emitters.length,
        bubbleSpeed: this.params.bubbleSpeed.toFixed(1),
      },
      emitters: this.emitters.map((e, i) => ({
        index: i,
        pos: `${e.position.x.toFixed(1)}, ${e.position.y.toFixed(1)}, ${e.position.z.toFixed(1)}`,
        freq: e.frequency.toFixed(2) + '/s',
      })),
    };
  }
}
