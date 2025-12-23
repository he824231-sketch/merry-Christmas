import React, { useState, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import Scene from './components/Scene';
import UI from './components/UI';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.FORMED);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // To handle communication from HandController (inside Canvas) back to App logic if needed, 
  // though we mostly drive state from inside or pass setAppState down.

  return (
    <div className="relative w-full h-screen bg-neutral-950 text-gold-500 font-serif">
      {/* Hidden webcam element for MediaPipe processing */}
      <div id="webcam-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }} 
        />
      </div>

      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: false, toneMappingExposure: 1.5 }}
        camera={{ position: [0, 1, 22], fov: 45 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene 
            appState={appState} 
            setAppState={setAppState} 
            videoRef={videoRef}
            canvasRef={canvasRef}
          />
        </Suspense>
      </Canvas>
      <Loader 
        containerStyles={{ background: '#050505' }} 
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ height: '10px', background: '#FFD700' }}
        dataStyles={{ color: '#FFD700', fontFamily: 'serif' }}
      />
      <UI appState={appState} setAppState={setAppState} />
    </div>
  );
};

export default App;