import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COUNT, TREE_HEIGHT, TREE_RADIUS_BASE, CHAOS_RADIUS } from '../constants';

interface FoliageProps {
  progressRef: React.MutableRefObject<number>;
}

// Shader Material
const FoliageMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uColor1: { value: new THREE.Color('#004225') }, // Deep Emerald
    uColor2: { value: new THREE.Color('#006633') }, // Lighter Green
    uGold: { value: new THREE.Color('#FFD700') },   // Gold tips
  },
  vertexShader: `
    uniform float uTime;
    uniform float uProgress;
    attribute vec3 aTargetPos;
    attribute vec3 aChaosPos;
    attribute float aRandom;
    
    varying vec2 vUv;
    varying float vRandom;
    varying float vMix;

    // Cubic easing for smoother transition
    float easeOutCubic(float x) {
      return 1.0 - pow(1.0 - x, 3.0);
    }

    void main() {
      vUv = uv;
      vRandom = aRandom;

      // Add some noise/wind movement
      vec3 noise = vec3(
        sin(uTime * 2.0 + aRandom * 10.0) * 0.1,
        cos(uTime * 1.5 + aRandom * 20.0) * 0.1,
        sin(uTime * 2.2 + aRandom * 15.0) * 0.1
      );

      // Lerp between Chaos and Target based on uProgress
      float t = easeOutCubic(uProgress);
      vec3 pos = mix(aChaosPos, aTargetPos, t);
      
      // Add wind only when formed (mostly)
      pos += noise * t;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation
      gl_PointSize = (60.0 * aRandom + 20.0) * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
      
      vMix = t;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uGold;
    varying float vRandom;
    varying float vMix;

    void main() {
      // Circular particle
      vec2 center = gl_PointCoord - 0.5;
      float dist = length(center);
      if (dist > 0.5) discard;

      // Soft edge
      float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

      // Color gradient based on randomness (depth)
      vec3 color = mix(uColor1, uColor2, vRandom);
      
      // Add gold sparkles based on vMix (only when formed)
      if (vMix > 0.8 && vRandom > 0.9) {
          color = mix(color, uGold, 0.8);
      }

      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const Foliage: React.FC<FoliageProps> = ({ progressRef }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Generate Geometry Data
  const { positions, chaosPositions, randoms } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const chaos = new Float32Array(PARTICLE_COUNT * 3);
    const rands = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // 1. Target Positions (Cone Shape / Tree)
      // Using spiral phyllotaxis for nice distribution
      const y = Math.random() * TREE_HEIGHT;
      const radiusAtHeight = (1 - y / TREE_HEIGHT) * TREE_RADIUS_BASE;
      const angle = i * 137.5 * (Math.PI / 180); // Golden angle
      const r = Math.sqrt(Math.random()) * radiusAtHeight; // Uniform disc distribution slice

      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * r;
      const ty = y + 1; // Lift off ground slightly

      pos[i * 3] = tx;
      pos[i * 3 + 1] = ty;
      pos[i * 3 + 2] = tz;

      // 2. Chaos Positions (Random Sphere/Cloud)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const cr = Math.cbrt(Math.random()) * CHAOS_RADIUS; // Uniform sphere
      
      chaos[i * 3] = cr * Math.sin(phi) * Math.cos(theta);
      chaos[i * 3 + 1] = cr * Math.sin(phi) * Math.sin(theta) + 10; // Center chaos higher
      chaos[i * 3 + 2] = cr * Math.cos(phi);

      // 3. Random attribute
      rands[i] = Math.random();
    }

    return { positions: pos, chaosPositions: chaos, randoms: rands };
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.uProgress.value = progressRef.current;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position" // This acts as base, but we use aTargetPos in shader
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={chaosPositions.length / 3}
          array={chaosPositions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={randoms.length}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <primitive object={FoliageMaterial} ref={materialRef} attach="material" />
    </points>
  );
};

export default Foliage;