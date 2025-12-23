import React, { useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AppState, HandGesture } from '../types';
import Foliage from './Foliage';
import Ornaments from './Ornaments';
import HandController from './HandController';
import PhotoCloud from './PhotoCloud';

interface SceneProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

const Scene: React.FC<SceneProps> = ({ appState, setAppState, videoRef, canvasRef }) => {
  const { scene } = useThree();
  const progressRef = useRef(appState === AppState.FORMED ? 1 : 0);
  const [gesture, setGesture] = useState<HandGesture>({ isFist: false, isOpen: false, isPinch: false, position: { x: 0.5, y: 0.5 } });
  
  const groupRef = useRef<THREE.Group>(null);
  const rayRef = useRef<THREE.Ray | null>(null);

  // Smoothly interpolate the progress based on state
  useFrame((state, delta) => {
    // If PHOTO_VIEW, we treat it like chaos for the background, but slow
    const target = appState === AppState.FORMED ? 1 : 0;
    
    // Faster transition speed (Doubled to 8.0)
    const smoothing = 8.0 * delta; 
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, smoothing);
    
    // Camera Hand Control (Rotation)
    // Only in CHAOS mode and when hand is detected
    if (appState === AppState.CHAOS && gesture.isOpen) {
        // Map 0-1 to -1 to 1
        const x = (gesture.position.x - 0.5) * 2;
        const y = (gesture.position.y - 0.5) * 2;
        
        // Rotate the main group slightly based on hand
        if (groupRef.current) {
            // INCREASED SENSITIVITY:
            // Y-rotation (horizontal movement): Increased multiplier from 2 to 6
            // X-rotation (vertical movement): Increased multiplier from 0.5 to 2
            groupRef.current.rotation.y += x * delta * 6;
            groupRef.current.rotation.x += y * delta * 2;
        }
    } else {
        // Auto drift if not controlling
        if (groupRef.current && appState === AppState.CHAOS) {
           groupRef.current.rotation.y += delta * 0.1;
        }
        // Auto rotate tree when formed
        if (groupRef.current && appState === AppState.FORMED) {
            groupRef.current.rotation.y += delta * 0.2;
             // Reset X rotation
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta);
        }
    }

    // Camera breathing
    const time = state.clock.getElapsedTime();
    // Base height 1 to match App.tsx camera prop
    state.camera.position.y = 1 + Math.sin(time * 0.1) * 0.5;
  });

  const handlePinch = (ray: THREE.Ray) => {
      rayRef.current = ray;
  };

  return (
    <>
      <HandController 
        videoRef={videoRef} 
        canvasRef={canvasRef}
        setGesture={setGesture} 
        setAppState={setAppState} 
        appState={appState}
        onPinch={handlePinch}
      />

      <PerspectiveCamera makeDefault position={[0, 1, 22]} fov={40} />
      <OrbitControls 
        enablePan={false} 
        minPolarAngle={Math.PI / 3} 
        maxPolarAngle={Math.PI / 2}
        minDistance={10}
        maxDistance={40}
        enabled={appState !== AppState.PHOTO_VIEW} // Disable controls when looking at photo
      />

      {/* Lighting - Luxury Gold Studio */}
      <ambientLight intensity={0.2} color="#001100" />
      <spotLight 
        position={[10, 20, 10]} 
        angle={0.25} 
        penumbra={1} 
        intensity={200} 
        color="#fff5cc" 
        castShadow 
      />
      <pointLight position={[-10, 5, -10]} intensity={50} color="#ffaa00" />
      <pointLight position={[0, -5, 5]} intensity={20} color="#00ffaa" />

      {/* Environment */}
      <Environment preset="city" background={false} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Background gradient hint */}
      <mesh scale={100} position={[0,0,-50]}>
        <planeGeometry />
        <meshBasicMaterial color="#010805" depthWrite={false} />
      </mesh>

      {/* Tree System Group - Rotatable by hand */}
      {/* Moved to -5 to center the 10-unit high tree */}
      <group ref={groupRef} position={[0, -5, 0]}>
        <Foliage progressRef={progressRef} />
        <Ornaments progressRef={progressRef} />
        <PhotoCloud 
            progressRef={progressRef} 
            appState={appState} 
            setAppState={setAppState} 
            rayRef={rayRef}
        />
        
        {/* A Base for the tree */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <cylinderGeometry args={[2, 2.5, 1, 32]} />
          <meshStandardMaterial 
            color="#1a1a1a" 
            roughness={0.2} 
            metalness={0.8} 
            envMapIntensity={2}
          />
        </mesh>
      </group>

      {/* Cinematic Post Processing */}
      <EffectComposer disableNormalPass>
        <Bloom 
          luminanceThreshold={0.8} 
          luminanceSmoothing={0.3} 
          intensity={1.2} 
          mipmapBlur 
        />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
        <Noise opacity={0.02} />
        {/* Depth of field for Photo Focus */}
        <DepthOfField 
            target={[0, 0, 0]} 
            focalLength={0.5} 
            bokehScale={appState === AppState.PHOTO_VIEW ? 5 : 0} 
            height={480} 
        />
      </EffectComposer>
    </>
  );
};

export default Scene;