import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrnamentData } from '../types';
import { COLORS, ORNAMENT_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS } from '../constants';

interface OrnamentsProps {
  progressRef: React.MutableRefObject<number>;
}

// Reusable geometry and material
const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// Luxurious Materials
const goldMat = new THREE.MeshStandardMaterial({ 
  color: COLORS.GOLD, 
  roughness: 0.1, 
  metalness: 1, 
  envMapIntensity: 2 
});
const redMat = new THREE.MeshStandardMaterial({ 
  color: COLORS.RED, 
  roughness: 0.15, 
  metalness: 0.7, 
  envMapIntensity: 1.5 
});
const whiteMat = new THREE.MeshStandardMaterial({
  color: COLORS.WHITE,
  roughness: 0.2,
  metalness: 0.1,
  emissive: COLORS.GOLD,
  emissiveIntensity: 0.1
});

const Ornaments: React.FC<OrnamentsProps> = ({ progressRef }) => {
  // We separate ornaments into instanced meshes by type/material for draw call optimization
  // 1. Gold Balls, 2. Red Balls, 3. Gold Boxes, 4. Red Boxes
  
  const meshRefs = {
    goldBalls: useRef<THREE.InstancedMesh>(null),
    redBalls: useRef<THREE.InstancedMesh>(null),
    goldBoxes: useRef<THREE.InstancedMesh>(null),
  };

  // Generate Data
  const data = useMemo(() => {
    const items: { [key: string]: OrnamentData[] } = {
      goldBalls: [],
      redBalls: [],
      goldBoxes: [],
    };

    for (let i = 0; i < ORNAMENT_COUNT; i++) {
      const isBox = Math.random() > 0.7; // 30% boxes
      const isGold = Math.random() > 0.4; // 60% gold

      let typeKey = '';
      if (isBox) typeKey = 'goldBoxes'; // All boxes gold/white for luxury
      else typeKey = isGold ? 'goldBalls' : 'redBalls';

      // Target Position (Tree)
      const y = Math.random() * (TREE_HEIGHT - 1) + 1;
      const radiusAtHeight = (1 - y / TREE_HEIGHT) * TREE_RADIUS_BASE;
      // Push ornaments slightly outside the foliage radius
      const r = radiusAtHeight + 0.2 + (Math.random() * 0.5); 
      const angle = Math.random() * Math.PI * 2;
      
      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * r;

      // Chaos Position
      const cx = (Math.random() - 0.5) * CHAOS_RADIUS * 1.5;
      const cy = (Math.random() - 0.5) * CHAOS_RADIUS + 10;
      const cz = (Math.random() - 0.5) * CHAOS_RADIUS * 1.5;

      const scale = isBox ? 0.3 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2;
      
      // Physics weight: Boxes are heavier (slower), Balls lighter (faster)
      // INCREASED SPEED: Multiplied base speeds to make gathering snappy and energetic
      const speed = isBox ? 8.0 + Math.random() * 4.0 : 12.0 + Math.random() * 6.0;

      items[typeKey].push({
        id: i,
        type: isBox ? 'box' : 'ball',
        color: isGold ? COLORS.GOLD : COLORS.RED,
        chaosPos: [cx, cy, cz],
        targetPos: [tx, y, tz],
        scale: scale,
        speed: speed,
        rotationSpeed: [Math.random(), Math.random(), Math.random()]
      });
    }
    return items;
  }, []);

  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{ [key: string]: THREE.Vector3[] }>({
    goldBalls: data.goldBalls.map(d => new THREE.Vector3(...d.chaosPos)),
    redBalls: data.redBalls.map(d => new THREE.Vector3(...d.chaosPos)),
    goldBoxes: data.goldBoxes.map(d => new THREE.Vector3(...d.chaosPos)),
  });

  useFrame((state, delta) => {
    const globalProgress = progressRef.current;
    const time = state.clock.getElapsedTime();

    // Helper to update specific instanced mesh
    const updateMesh = (key: string, ref: THREE.InstancedMesh | null) => {
      if (!ref) return;

      const items = data[key as keyof typeof data];
      const currentPosArr = currentPositions.current[key];

      items.forEach((item, i) => {
        // Calculate target based on global progress
        // 0 = Chaos, 1 = Formed
        // However, we want individual physics.
        // If global is 1, target is item.targetPos.
        // If global is 0, target is item.chaosPos.
        
        const targetVec = globalProgress > 0.5 
          ? new THREE.Vector3(...item.targetPos)
          : new THREE.Vector3(...item.chaosPos);

        // Lerp current position towards the target vector
        // The speed determines how fast they react ("weight")
        const lerpFactor = THREE.MathUtils.clamp(delta * item.speed, 0, 1);
        currentPosArr[i].lerp(targetVec, lerpFactor);

        tempObj.position.copy(currentPosArr[i]);
        tempObj.scale.setScalar(item.scale);
        
        // Rotate ornaments slightly
        tempObj.rotation.x = time * item.rotationSpeed[0];
        tempObj.rotation.y = time * item.rotationSpeed[1];
        
        // If Formed, orient boxes to look proper? Na, random spin is fancy glint.
        
        tempObj.updateMatrix();
        ref.setMatrixAt(i, tempObj.matrix);
      });
      ref.instanceMatrix.needsUpdate = true;
    };

    updateMesh('goldBalls', meshRefs.goldBalls.current);
    updateMesh('redBalls', meshRefs.redBalls.current);
    updateMesh('goldBoxes', meshRefs.goldBoxes.current);
  });

  return (
    <group>
      <instancedMesh
        ref={meshRefs.goldBalls}
        args={[sphereGeo, goldMat, data.goldBalls.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={meshRefs.redBalls}
        args={[sphereGeo, redMat, data.redBalls.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={meshRefs.goldBoxes}
        args={[boxGeo, whiteMat, data.goldBoxes.length]}
        castShadow
        receiveShadow
      />
    </group>
  );
};

export default Ornaments;