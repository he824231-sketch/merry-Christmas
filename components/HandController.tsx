import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { AppState, HandGesture } from '../types';

interface HandControllerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  setGesture: (gesture: HandGesture) => void;
  setAppState: (state: AppState) => void;
  appState: AppState;
  onPinch: (ray: THREE.Ray) => void;
}

const HandController: React.FC<HandControllerProps> = ({ videoRef, canvasRef, setGesture, setAppState, appState, onPinch }) => {
  const { camera } = useThree();
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const gestureTimeoutRef = useRef(0);
  const wasPinchingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      );
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.2, 
        minTrackingConfidence: 0.2,      
        minHandPresenceConfidence: 0.2
      });

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 320, 
                height: 240, 
                facingMode: "user",
                frameRate: { ideal: 60, min: 30 } 
            } 
          });
          videoRef.current.srcObject = stream;
        } catch (err) {
          console.error("Camera access denied", err);
        }
      }
    };
    init();
  }, [videoRef]);

  useEffect(() => {
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            drawingUtilsRef.current = new DrawingUtils(ctx);
        }
    }
  }, [canvasRef]);

  useFrame(() => {
    const video = videoRef.current;
    if (!video || !landmarkerRef.current || video.readyState < 2) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const results = landmarkerRef.current.detectForVideo(video, performance.now());

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx && drawingUtilsRef.current) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (results.landmarks) {
            for (const landmarks of results.landmarks) {
                drawingUtilsRef.current.drawConnectors(
                    landmarks, 
                    HandLandmarker.HAND_CONNECTIONS, 
                    { color: "#FFD700", lineWidth: 3 }
                );
                drawingUtilsRef.current.drawLandmarks(
                    landmarks, 
                    { color: "#004225", lineWidth: 1, radius: 3 }
                );
            }
        }
      }

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        // --- Geometry Helpers ---
        // Calculate distance from wrist to a landmark
        const getDist = (idx: number) => Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y);

        // Calculate curl ratio: Tip Distance / MCP Distance
        // Ratio > 1.2 : Extended
        // Ratio < 1.0 : Curled
        const getRatio = (tipIdx: number, mcpIdx: number) => getDist(tipIdx) / getDist(mcpIdx);

        const indexRatio = getRatio(8, 5);
        const middleRatio = getRatio(12, 9);
        const ringRatio = getRatio(16, 13);
        const pinkyRatio = getRatio(20, 17);

        // Average curl of the whole hand
        const avgRatio = (indexRatio + middleRatio + ringRatio + pinkyRatio) / 4;
        
        // Average curl of just the bottom 3 fingers (Middle, Ring, Pinky)
        // This is critical for distinguishing "Pinch" from "Fist"
        const nonIndexRatio = (middleRatio + ringRatio + pinkyRatio) / 3;

        // 1. Pinch Candidate Check
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const isPinchCandidate = pinchDist < 0.08;

        // --- INTELLIGENT GESTURE CLASSIFICATION ---

        let isFist = false;
        let isPinch = false;
        let isOpen = false;

        // Rule 1: FIST
        // If the whole hand is curled tight
        if (avgRatio < 1.35) {
            isFist = true;
        } 
        
        // Rule 2: PINCH
        // Valid ONLY if thumb/index are close AND the rest of the hand is NOT tightly curled.
        // If nonIndexRatio < 1.2, it means middle/ring/pinky are curling in -> likely forming a fist -> IGNORE PINCH.
        else if (isPinchCandidate && nonIndexRatio > 1.2) {
            isPinch = true;
        }

        // Rule 3: OPEN
        // Hand is spread out
        else {
            const palmWidth = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
            const spreadWidth = Math.hypot(landmarks[8].x - landmarks[20].x, landmarks[8].y - landmarks[20].y);
            const spreadFactor = spreadWidth / (palmWidth || 1);
            
            if ((avgRatio > 1.5) || (spreadFactor > 1.6 && avgRatio > 1.25)) {
                isOpen = true;
            }
        }

        // --- Coordinate Calculation ---
        let rawX, rawY;
        if (isPinch || pinchDist < 0.15) {
             rawX = (thumbTip.x + indexTip.x) / 2;
             rawY = (thumbTip.y + indexTip.y) / 2;
        } else {
             rawX = (landmarks[5].x + landmarks[17].x) / 2;
             rawY = (landmarks[5].y + landmarks[17].y) / 2;
        }

        // --- Visual Feedback ---
        if (ctx && canvas) {
            ctx.beginPath();
            ctx.arc(rawX * canvas.width, rawY * canvas.height, isPinch ? 10 : 5, 0, 2 * Math.PI);
            ctx.fillStyle = isPinch ? "#FF0000" : (isFist ? "#AAAAAA" : "#FFFFFF"); 
            ctx.fill();
            ctx.strokeStyle = "#FFD700";
            ctx.stroke();
        }

        const handX = 1 - rawX;
        const handY = rawY;

        setGesture({ isFist, isOpen, isPinch, position: { x: handX, y: handY } });

        const now = Date.now();

        // --- Actions ---
        
        // PINCH ACTION
        if (isPinch) {
            if (!wasPinchingRef.current) {
                const ndcX = (handX * 2) - 1;
                const ndcY = -(handY * 2) + 1; 

                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
                
                onPinch(raycaster.ray);
            }
            gestureTimeoutRef.current = now + 500;
        }
        wasPinchingRef.current = isPinch;

        // STATE SWITCHING (Fist/Open)
        if (now > gestureTimeoutRef.current && !isPinch) {
          if (isFist) {
             if (appState === AppState.CHAOS) {
                setAppState(AppState.FORMED);
                gestureTimeoutRef.current = now + 1000;
             }
          } else if (isOpen) {
             if (appState === AppState.FORMED || appState === AppState.PHOTO_VIEW) {
                setAppState(AppState.CHAOS);
                gestureTimeoutRef.current = now + 1000;
             }
          }
        }
      } else {
        setGesture({ isFist: false, isOpen: false, isPinch: false, position: { x: 0.5, y: 0.5 } });
        wasPinchingRef.current = false;
      }
    }
  });

  return null;
};

export default HandController;