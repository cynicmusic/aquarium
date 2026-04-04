import * as THREE from 'three';

/**
 * Cute crabs that walk across the sand floor, occasionally raising claws and pinching.
 */
export class CrabSystem {
  constructor(aquariumScene) {
    this.aquariumScene = aquariumScene;
    this.crabs = [];
    this._spawnDefaults();
  }

  _createCrabMesh() {
    const group = new THREE.Group();

    // Body — flattened ellipsoid
    const bodyGeo = new THREE.SphereGeometry(0.3, 10, 8);
    bodyGeo.scale(1.2, 0.5, 1.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(
        0.02 + Math.random() * 0.06, // orange-red hue
        0.7 + Math.random() * 0.2,
        0.35 + Math.random() * 0.15,
      ),
      roughness: 0.7,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.15;
    body.castShadow = true;
    group.add(body);

    // Eyes — two stalks
    for (let side = -1; side <= 1; side += 2) {
      const eyeStalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.12, 4),
        bodyMat,
      );
      eyeStalk.position.set(side * 0.12, 0.35, -0.15);
      group.add(eyeStalk);

      const eyeBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      eyeBall.position.set(side * 0.12, 0.42, -0.15);
      group.add(eyeBall);
    }

    // Claws — two arms with pincers
    const clawMat = bodyMat.clone();
    clawMat.color = bodyMat.color.clone().offsetHSL(0, 0, 0.05);

    for (let side = -1; side <= 1; side += 2) {
      const clawGroup = new THREE.Group();
      clawGroup.name = side > 0 ? 'rightClaw' : 'leftClaw';

      // Arm segment
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 0.25, 5),
        clawMat,
      );
      arm.rotation.z = side * 0.8;
      arm.position.set(side * 0.15, 0.05, 0);
      clawGroup.add(arm);

      // Pincer top
      const pincerTop = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 0.06),
        clawMat,
      );
      pincerTop.position.set(side * 0.32, 0.12, 0);
      pincerTop.name = 'pincerTop';
      clawGroup.add(pincerTop);

      // Pincer bottom
      const pincerBot = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.03, 0.06),
        clawMat,
      );
      pincerBot.position.set(side * 0.32, 0.06, 0);
      pincerBot.name = 'pincerBot';
      clawGroup.add(pincerBot);

      clawGroup.position.set(side * 0.2, 0.12, -0.05);
      group.add(clawGroup);
    }

    // Legs — 3 pairs
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.015, 0.2, 4),
          clawMat,
        );
        leg.rotation.z = side * (0.6 + i * 0.15);
        leg.rotation.y = (i - 1) * 0.3;
        leg.position.set(
          side * (0.25 + i * 0.02),
          0.05,
          -0.1 + i * 0.1,
        );
        leg.name = `leg_${side > 0 ? 'r' : 'l'}_${i}`;
        group.add(leg);
      }
    }

    group.scale.setScalar(0.8 + Math.random() * 0.4);
    return group;
  }

  _spawnDefaults() {
    const { tankWidth, tankDepth } = this.aquariumScene.params;

    for (let i = 0; i < 3; i++) {
      const mesh = this._createCrabMesh();
      const x = (Math.random() - 0.5) * tankWidth * 0.7;
      const z = (Math.random() - 0.5) * tankDepth * 0.5;
      mesh.position.set(x, 0.05, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;

      this.aquariumScene.scene.add(mesh);

      this.crabs.push({
        mesh,
        velocity: new THREE.Vector3(),
        target: new THREE.Vector3(
          (Math.random() - 0.5) * tankWidth * 0.6,
          0.05,
          (Math.random() - 0.5) * tankDepth * 0.4,
        ),
        moveTimer: 2 + Math.random() * 5,
        pauseTimer: 0,
        isPaused: false,
        pinchTimer: 0,
        isPinching: false,
        pinchPhase: 0,
        clawRaised: false,
        raiseTimer: 0,
        walkPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt, elapsed) {
    const { tankWidth, tankDepth } = this.aquariumScene.params;

    for (const crab of this.crabs) {
      // Pinch animation
      if (crab.isPinching) {
        crab.pinchPhase += dt * 12;
        const pinchAngle = Math.sin(crab.pinchPhase) * 0.15;
        crab.mesh.children.forEach(child => {
          if (child.name === 'rightClaw' || child.name === 'leftClaw') {
            child.children.forEach(part => {
              if (part.name === 'pincerTop') part.rotation.z = pinchAngle;
              if (part.name === 'pincerBot') part.rotation.z = -pinchAngle;
            });
          }
        });
        crab.pinchTimer -= dt;
        if (crab.pinchTimer <= 0) {
          crab.isPinching = false;
        }
      }

      // Claw raise animation
      if (crab.clawRaised) {
        crab.raiseTimer -= dt;
        const side = Math.random() > 0.5 ? 'rightClaw' : 'leftClaw';
        crab.mesh.children.forEach(child => {
          if (child.name === side) {
            child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, -0.8, dt * 3);
          }
        });
        if (crab.raiseTimer <= 0) {
          crab.clawRaised = false;
          crab.mesh.children.forEach(child => {
            if (child.name === 'rightClaw' || child.name === 'leftClaw') {
              child.rotation.x = 0;
            }
          });
        }
      }

      // Random events
      if (Math.random() < dt * 0.15) {
        crab.isPinching = true;
        crab.pinchTimer = 0.5 + Math.random() * 1.0;
        crab.pinchPhase = 0;
      }
      if (Math.random() < dt * 0.08) {
        crab.clawRaised = true;
        crab.raiseTimer = 1.0 + Math.random() * 2.0;
      }

      // Pause behavior
      if (crab.isPaused) {
        crab.pauseTimer -= dt;
        if (crab.pauseTimer <= 0) {
          crab.isPaused = false;
          // Pick new target
          crab.target.set(
            (Math.random() - 0.5) * tankWidth * 0.6,
            0.05,
            (Math.random() - 0.5) * tankDepth * 0.4,
          );
          crab.moveTimer = 3 + Math.random() * 6;
        }
        continue;
      }

      // Move toward target (sideways walking!)
      const toTarget = crab.target.clone().sub(crab.mesh.position);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist < 0.5 || crab.moveTimer <= 0) {
        // Reached target or time's up — pause
        crab.isPaused = true;
        crab.pauseTimer = 1 + Math.random() * 3;
        crab.velocity.set(0, 0, 0);
        continue;
      }

      crab.moveTimer -= dt;

      // Crabs walk sideways! Face perpendicular to movement
      const moveDir = toTarget.normalize();
      const speed = 0.3 + Math.random() * 0.1;
      crab.velocity.lerp(moveDir.multiplyScalar(speed), dt * 2);
      crab.mesh.position.addScaledVector(crab.velocity, dt);
      crab.mesh.position.y = 0.05; // Stay on sand

      // Face sideways relative to movement direction
      const sideAngle = Math.atan2(crab.velocity.x, crab.velocity.z) + Math.PI / 2;
      let angleDiff = sideAngle - crab.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      crab.mesh.rotation.y += angleDiff * dt * 2.0;

      // Walking animation — bob legs
      crab.walkPhase += dt * 8;
      const legBob = Math.sin(crab.walkPhase) * 0.15;
      crab.mesh.children.forEach(child => {
        if (child.name && child.name.startsWith('leg_')) {
          const idx = parseInt(child.name.split('_')[2]);
          child.rotation.x = Math.sin(crab.walkPhase + idx * 1.2) * 0.2;
        }
      });

      // Keep in bounds
      const pos = crab.mesh.position;
      if (Math.abs(pos.x) > tankWidth * 0.45) pos.x = Math.sign(pos.x) * tankWidth * 0.45;
      if (Math.abs(pos.z) > tankDepth * 0.4) pos.z = Math.sign(pos.z) * tankDepth * 0.4;
    }
  }

  getDebugInfo() {
    return {
      name: 'Crabs',
      params: {
        totalCrabs: this.crabs.length,
      },
    };
  }
}
