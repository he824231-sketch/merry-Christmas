export enum AppState {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED',
  PHOTO_VIEW = 'PHOTO_VIEW',
}

export interface OrnamentData {
  id: number;
  type: 'box' | 'ball' | 'light';
  color: string;
  chaosPos: [number, number, number];
  targetPos: [number, number, number];
  scale: number;
  speed: number; // For physics lerp weight
  rotationSpeed: [number, number, number];
}

export interface HandGesture {
  isFist: boolean;
  isOpen: boolean;
  isPinch: boolean;
  position: { x: number; y: number }; // Normalized 0-1
}

export interface PhotoData {
  id: number;
  url: string;
  chaosPos: [number, number, number];
  targetPos: [number, number, number];
  aspect: number;
}