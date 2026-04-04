import * as THREE from 'three';

/**
 * Foreground seafloor elements — shells, lobster, starfish
 */
export class SeafloorCreatures {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.creatures = [];
    this.shells = [];
    this._spawnShells();
    this._spawnLobster();
  }

  _spawnShells() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;

    // Several shells scattered in the foreground
    const shellTypes = ['conch', 'clam', 'spiral', 'scallop', 'conch'];
    for (let i = 0; i < shellTypes.length; i++) {
      const mesh = this._createShell(shellTypes[i]);
      const x = ((i / shellTypes.length) - 0.5) * tankWidth * 0.8 + (Math.random() - 0.5) * 3;
      const z = tankDepth * 0.25 + Math.random() * tankDepth * 0.15;
      mesh.position.set(x, 0.08, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.aquariumScene.scene.add(mesh);
      this.shells.push(mesh);
    }
  }

  _createShell(type) {
    const group = new THREE.Group();
    const shellColors = [0xf5e6d3, 0xe8d5b7, 0xdcc8a0, 0xf0dfc8, 0xd4b896];
    const color = shellColors[Math.floor(Math.random() * shellColors.length)];
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.05,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.05,
    });

    switch (type) {
      case 'conch': {
        // Spiral conch shell
        const geo = new THREE.TorusGeometry(0.15, 0.06, 8, 12, Math.PI * 1.5);
        const shell = new THREE.Mesh(geo, mat);
        shell.rotation.x = Math.PI / 2;
        shell.scale.set(1, 1, 0.6);
        group.add(shell);
        // Tip
        const tipGeo = new THREE.ConeGeometry(0.06, 0.15, 6);
        const tip = new THREE.Mesh(tipGeo, mat);
        tip.position.set(0.15, 0, 0.02);
        tip.rotation.z = Math.PI / 2;
        group.add(tip);
        break;
      }
      case 'clam': {
        // Two-halved clam
        const halfGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI);
        const top = new THREE.Mesh(halfGeo, mat);
        top.rotation.x = -0.2;
        group.add(top);
        const bottom = new THREE.Mesh(halfGeo, mat);
        bottom.rotation.x = Math.PI + 0.2;
        group.add(bottom);
        // Pearl inside
        const pearlMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, roughness: 0.2, metalness: 0.3,
          emissive: 0xffeedd, emissiveIntensity: 0.2,
        });
        const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), pearlMat);
        pearl.position.set(0, 0.02, 0);
        group.add(pearl);
        break;
      }
      case 'spiral': {
        // Small spiral shell
        const points = [];
        for (let i = 0; i < 20; i++) {
          const t = i / 19;
          const r = 0.05 + t * 0.1;
          points.push(new THREE.Vector2(r, t * 0.2));
        }
        const geo = new THREE.LatheGeometry(points, 12);
        const shell = new THREE.Mesh(geo, mat);
        shell.scale.setScalar(0.8);
        group.add(shell);
        break;
      }
      case 'scallop': {
        // Fan-shaped scallop
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        for (let i = 0; i <= 12; i++) {
          const angle = (i / 12) * Math.PI;
          const r = 0.12 + Math.sin(i * 2) * 0.02;
          shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        shape.lineTo(0, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
        const shell = new THREE.Mesh(geo, mat);
        shell.rotation.x = -Math.PI / 2;
        group.add(shell);
        break;
      }
    }

    group.scale.setScalar(1.5 + Math.random() * 1.0);
    return group;
  }

  _spawnLobster() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;
    const lobster = this._createLobster();
    // Position in the very foreground
    lobster.position.set(
      (Math.random() - 0.5) * tankWidth * 0.5,
      0.1,
      tankDepth * 0.35,
    );
    this.aquariumScene.scene.add(lobster);

    this.creatures.push({
      mesh: lobster,
      type: 'lobster',
      direction: 1,
      speed: 0.15,
      paceTimer: 3 + Math.random() * 5,
      clawRaised: false,
      clawTimer: 0,
      walkPhase: 0,
      turnLeftAt: -tankWidth * 0.35,
      turnRightAt: tankWidth * 0.35,
    });
  }

  _createLobster() {
    const group = new THREE.Group();
    const lobsterColor = 0xcc3322;
    const mat = new THREE.MeshStandardMaterial({
      color: lobsterColor,
      roughness: 0.6,
      metalness: 0.15,
      emissive: new THREE.Color(lobsterColor),
      emissiveIntensity: 0.08,
    });
    const darkMat = mat.clone();
    darkMat.color.set(0x991a10);

    // Body — elongated segments
    for (let i = 0; i < 5; i++) {
      const segGeo = new THREE.SphereGeometry(0.12 - i * 0.01, 8, 6);
      segGeo.scale(1.2, 0.6, 1);
      const seg = new THREE.Mesh(segGeo, mat);
      seg.position.set(0, 0, i * 0.18);
      seg.castShadow = true;
      group.add(seg);
    }

    // Tail fan
    const tailGeo = new THREE.ConeGeometry(0.1, 0.2, 6);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.position.set(0, 0, 0.9);
    tail.rotation.x = Math.PI / 2;
    group.add(tail);

    // Head
    const headGeo = new THREE.SphereGeometry(0.1, 8, 6);
    headGeo.scale(1.0, 0.7, 1.3);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 0.02, -0.15);
    group.add(head);

    // Eyes
    for (let side = -1; side <= 1; side += 2) {
      const eyeStalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.08, 4),
        darkMat,
      );
      eyeStalk.position.set(side * 0.07, 0.08, -0.2);
      eyeStalk.rotation.z = side * 0.3;
      group.add(eyeStalk);

      const eyeBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      eyeBall.position.set(side * 0.08, 0.13, -0.2);
      group.add(eyeBall);
    }

    // Antennae
    for (let side = -1; side <= 1; side += 2) {
      const antennaGeo = new THREE.CylinderGeometry(0.008, 0.004, 0.4, 3);
      const antenna = new THREE.Mesh(antennaGeo, darkMat);
      antenna.position.set(side * 0.05, 0.05, -0.3);
      antenna.rotation.x = -0.5;
      antenna.rotation.z = side * 0.4;
      group.add(antenna);
    }

    // Claws
    for (let side = -1; side <= 1; side += 2) {
      const clawGroup = new THREE.Group();
      clawGroup.name = side > 0 ? 'rightClaw' : 'leftClaw';

      // Arm
      const armGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.25, 5);
      const arm = new THREE.Mesh(armGeo, mat);
      arm.rotation.z = side * 0.6;
      arm.position.set(side * 0.1, 0, 0);
      clawGroup.add(arm);

      // Claw pincer — two halves
      const pincerGeo = new THREE.BoxGeometry(0.08, 0.025, 0.05);
      const pTop = new THREE.Mesh(pincerGeo, mat);
      pTop.position.set(side * 0.25, 0.04, 0);
      pTop.name = 'pincerTop';
      clawGroup.add(pTop);

      const pBot = new THREE.Mesh(pincerGeo, mat);
      pBot.position.set(side * 0.25, 0.01, 0);
      pBot.name = 'pincerBot';
      clawGroup.add(pBot);

      clawGroup.position.set(side * 0.08, 0, -0.25);
      group.add(clawGroup);
    }

    // Legs — 4 pairs
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const legGeo = new THREE.CylinderGeometry(0.012, 0.008, 0.15, 3);
        const leg = new THREE.Mesh(legGeo, darkMat);
        leg.rotation.z = side * 0.7;
        leg.position.set(side * 0.1, -0.05, i * 0.15);
        leg.name = `leg_${side > 0 ? 'r' : 'l'}_${i}`;
        group.add(leg);
      }
    }

    group.scale.setScalar(2.0);
    group.rotation.y = Math.PI / 2; // Face sideways
    return group;
  }

  update(dt, elapsed) {
    for (const creature of this.creatures) {
      if (creature.type === 'lobster') {
        this._updateLobster(creature, dt, elapsed);
      }
    }
  }

  _updateLobster(lobster, dt, elapsed) {
    const pos = lobster.mesh.position;

    // Waddle movement — sideways
    pos.x += lobster.direction * lobster.speed * dt;

    // Walking animation
    lobster.walkPhase += dt * 6;
    lobster.mesh.children.forEach(child => {
      if (child.name && child.name.startsWith('leg_')) {
        const idx = parseInt(child.name.split('_')[2]);
        child.rotation.x = Math.sin(lobster.walkPhase + idx * 1.5) * 0.25;
      }
    });

    // Turn at edges
    if (pos.x >= lobster.turnRightAt) {
      lobster.direction = -1;
      lobster.mesh.rotation.y = -Math.PI / 2;
    } else if (pos.x <= lobster.turnLeftAt) {
      lobster.direction = 1;
      lobster.mesh.rotation.y = Math.PI / 2;
    }

    // Intermittent claw raising
    if (!lobster.clawRaised && Math.random() < dt * 0.1) {
      lobster.clawRaised = true;
      lobster.clawTimer = 1.0 + Math.random() * 2.0;
    }

    if (lobster.clawRaised) {
      lobster.clawTimer -= dt;
      // Raise one claw and pinch
      const pinchAngle = Math.sin(elapsed * 8) * 0.12;
      lobster.mesh.children.forEach(child => {
        if (child.name === 'rightClaw') {
          child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, -0.6, dt * 4);
          child.children.forEach(p => {
            if (p.name === 'pincerTop') p.rotation.z = pinchAngle;
            if (p.name === 'pincerBot') p.rotation.z = -pinchAngle;
          });
        }
      });

      if (lobster.clawTimer <= 0) {
        lobster.clawRaised = false;
        lobster.mesh.children.forEach(child => {
          if (child.name === 'rightClaw') {
            child.rotation.x = 0;
          }
        });
      }
    }

    pos.y = 0.1; // Stay on sand
  }

  getDebugInfo() {
    return {
      name: 'Seafloor',
      params: {
        shells: this.shells.length,
        creatures: this.creatures.length,
      },
    };
  }
}
