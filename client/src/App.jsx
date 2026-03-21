/**
 * This file renders WorldShell on the R3F canvas
 */

import { useEffect, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import { Canvas } from "@react-three/fiber"
import { ACESFilmicToneMapping } from "three";
import { Physics } from "@react-three/rapier";
import WorldShell from "./scenes/WorldShell.jsx";
import LandingPresentationLayer from "./scenes/LandingPresentationLayer.jsx";
import SharedEnvironment from "./scenes/SharedEnvironment.jsx";
import Landing from "./ui/Landing.jsx";
import LandingJoin from "./ui/LandingJoin.jsx";
import GameOverlay from "./ui/GameOverlay.jsx";
import ChatPanel from "./ui/ChatPanel.jsx";

import { useGameStore } from "./store/useGameStore.js";
import { INITIAL_WORLD_CAMERA_POSITION } from "./constants/playerControls.js";

const App = () => {
  const cameraLockMode = useGameStore((state) => state.cameraLockMode);
  const isInRoom = useGameStore((state) => Boolean(state.currentRoomId));
  const sunsetMode = useGameStore((state) => state.sunsetMode);
  const shadowsEnabled = useGameStore((state) => state.shadowsEnabled);
  const debugModeEnabled = useGameStore((state) => state.debugModeEnabled);
  const setCameraLockMode = useGameStore((state) => state.setCameraLockMode);

  // listen to when shift camera lock is activated through handlePointerLockChange in usePlayerInput - used app wide
  useEffect(() => {
    const handlePointerLockChange = () => {
      const canvas = document.querySelector("canvas");
      const isCanvasLocked = Boolean(canvas) && document.pointerLockElement === canvas;
      setCameraLockMode(isCanvasLocked);
    };

    const handlePointerLockError = () => {
      setCameraLockMode(false);
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    return () => {
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
    };
  }, [setCameraLockMode]);

  return (
      <div className={`relative w-full h-full ${isInRoom && cameraLockMode ? "cursor-none" : ""}`}>
        <Canvas 
          shadows={shadowsEnabled}
          className="w-full h-full"
          camera={{ position: [44, 16, 0] }}
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.7,
          }}
        > 
          {/* need to wrap in Suspense because WorldShell has async loaders (like useGLTF) that can suspend (need to wait) */}
          <Suspense>
            <Physics debug={debugModeEnabled} colliders="cuboid" gravity={[0, -9.81, 0]}>
              <SharedEnvironment
                debug={debugModeEnabled}
                isSunset={sunsetMode}
                useOceanShaders={false}
                shadowsEnabled={shadowsEnabled}
              />
              {isInRoom ? <WorldShell /> : <LandingPresentationLayer />}
            </Physics>
          </Suspense>

        </Canvas>
        
        {isInRoom ? 
          <>  
            <GameOverlay />
            <ChatPanel />
          </>
          : 
          <Routes>
            <Route path="/" element={<Landing/> } />
            <Route path="/rooms/:roomId" element={<LandingJoin/>} />
          </Routes>
          
        }
      </div>
    
  )
}

export default App
