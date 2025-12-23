import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Image } from '@react-three/drei';
import * as THREE from 'three';
import { PhotoData, AppState } from '../types';
import { CHAOS_RADIUS, TREE_HEIGHT, TREE_RADIUS_BASE } from '../constants';

interface PhotoCloudProps {
  progressRef: React.MutableRefObject<number>;
  appState: AppState;
  rayRef: React.MutableRefObject<THREE.Ray | null>;
  setAppState: (state: AppState) => void;
}

// Generate luxury placeholder images internally
const createPlaceholder = (bgColor: string, fgColor: string, text: string) => {
  if (typeof document === 'undefined') return ''; 
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 600, 400);

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, 560, 360);
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, 540, 340);

  ctx.fillStyle = fgColor;
  ctx.font = 'italic bold 60px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('The Grand', 300, 160);
  
  ctx.font = '40px "Lato", sans-serif';
  ctx.fillText(text, 300, 240);

  return canvas.toDataURL('image/png');
};

const IMAGES = [
  // CRASH FIX: Used a placeholder by default to prevent "Could not load..." error.
  // To use your own image, ensure 'cat_guns.png' is in the public folder and uncomment the line below:
  // '/cat_guns.png',
  createPlaceholder('#1a1a1a', '#FFD700', 'Cat w/ Guns'),
  createPlaceholder('#8B6508', '#FFFFFF', 'Collection I'), 
  createPlaceholder('#004225', '#FFD700', 'Collection II'), 
  createPlaceholder('#800000', '#F9F1D8', 'Collection III'), 
  createPlaceholder('#1a1a1a', '#FFD700', 'VIP Access'), 
  createPlaceholder('#002a17', '#FFFFFF', 'Winter Gala'), 
  createPlaceholder('#550000', '#FFD700', 'Royal Edition'), 
];

const PhotoCloud: React.FC<PhotoCloudProps> = ({ progressRef, appState, rayRef, setAppState }) => {
  const [activePhotoId, setActivePhotoId] = useState<number | null>(null);
  
  const photos = useMemo(() => {
    const arr: PhotoData[] = [];
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const y = (i / 12) * TREE_HEIGHT * 0.8 + 2;
        const r = ((1 - y / TREE_HEIGHT) * TREE_RADIUS_BASE) + 1.5;
        const tx = Math.cos(angle * 2) * r;
        const tz = Math.sin(angle * 2) * r;

        const cx = (Math.random() - 0.5) * CHAOS_RADIUS * 1.2;
        const cy = (Math.random() - 0.5) * CHAOS_RADIUS + 8;
        const cz = (Math.random() - 0.5) * CHAOS_RADIUS * 1.2;

        const imgIndex = i % IMAGES.length;
        const isCat = imgIndex === 0;

        arr.push({
            id: i,
            url: IMAGES[imgIndex],
            chaosPos: [cx, cy, cz],
            targetPos: [tx, y, tz],
            aspect: isCat ? 1.2 : 1.5
        });
    }
    return arr;
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    // Check intersection if pinch is active via rayRef
    if (rayRef.current && appState !== AppState.PHOTO_VIEW) {
        let closestDist = Infinity;
        let closestId = -1;

        groupRef.current.children.forEach((child, idx) => {
            const pos = new THREE.Vector3();
            child.getWorldPosition(pos);
            const dist = rayRef.current!.distanceSqToPoint(pos);
            
            // Increased threshold for easier grabbing (approx 2.2 units radius)
            if (dist < 5.0) { 
                 if (dist < closestDist) {
                     closestDist = dist;
                     closestId = photos[idx].id;
                 }
            }
        });

        if (closestId !== -1) {
            setActivePhotoId(closestId);
            setAppState(AppState.PHOTO_VIEW);
            rayRef.current = null; // Consume the click
        }
    } else if (appState !== AppState.PHOTO_VIEW) {
        setActivePhotoId(null);
    }

    groupRef.current.children.forEach((child, i) => {
        const photo = photos[i];
        let target: THREE.Vector3;
        let scale = 1.0;
        let quaternion = new THREE.Quaternion();

        if (appState === AppState.PHOTO_VIEW && photo.id === activePhotoId) {
             // Move to front center
             const camPos = state.camera.position.clone();
             const camDir = new THREE.Vector3(0,0,-1).applyQuaternion(state.camera.quaternion);
             target = camPos.add(camDir.multiplyScalar(8)); 
             scale = 3.0;
             quaternion.copy(state.camera.quaternion);
        } else {
             // Normal interpolation
             const chaos = new THREE.Vector3(...photo.chaosPos);
             const formed = new THREE.Vector3(...photo.targetPos);
             const mix = appState === AppState.PHOTO_VIEW ? 0 : progressRef.current;
             target = new THREE.Vector3().lerpVectors(chaos, formed, mix);
             
             const lookAtPos = new THREE.Vector3(0, target.y, 0);
             const dummy = new THREE.Object3D();
             dummy.position.copy(target);
             dummy.lookAt(lookAtPos);
             quaternion.copy(dummy.quaternion);
        }

        // Physics Lerp
        child.position.lerp(target, delta * 6);
        child.quaternion.slerp(quaternion, delta * 6);
        
        const currentScale = child.scale.x; 
        const targetScale = scale * (appState === AppState.FORMED ? 0.8 : 1.2);
        const newScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 4);
        child.scale.setScalar(newScale);
    });
  });

  return (
    <group ref={groupRef}>
      {photos.map((photo, i) => (
        <group key={photo.id}>
            {/* Gold Frame */}
            <mesh position={[0,0,-0.05]}>
                <boxGeometry args={[photo.aspect + 0.2, 1.2, 0.05]} />
                <meshStandardMaterial 
                    color="#FFD700" 
                    metalness={1} 
                    roughness={0.1} 
                    envMapIntensity={2}
                />
            </mesh>
            {/* Photo */}
            <Image 
                url={photo.url} 
                transparent 
                scale={[photo.aspect, 1, 1]}
                toneMapped={false}
            />
        </group>
      ))}
    </group>
  );
};

export default PhotoCloud;