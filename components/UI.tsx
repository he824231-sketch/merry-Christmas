import React from 'react';
import { AppState } from '../types';

interface UIProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
}

const UI: React.FC<UIProps> = () => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-12 z-10">
      {/* Top section empty to keep footer at bottom via justify-between */}
      <div></div>
      
      {/* Footer decorator removed */}
    </div>
  );
};

export default UI;