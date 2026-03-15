/**
 * This file renders WorldShell on the R3F canvas
 */

import { useEffect } from "react";
import { Suspense } from 'react';
import { Canvas } from "@react-three/fiber"
import { ACESFilmicToneMapping } from "three";
import { Physics } from "@react-three/rapier";
import WorldShell from "./scenes/WorldShell.jsx";
import LandingPresentationLayer from "./scenes/LandingPresentationLayer.jsx";
import Landing from "./ui/Landing.jsx";
import GameOverlay from "./ui/GameOverlay.jsx";

import { useGameStore } from "./store/useGameStore.js";

const isDevMode = import.meta.env.VITE_DEV_MODE === "true";

const App = () => {
  const cameraLockMode = useGameStore((state) => state.cameraLockMode);
  const hasCreatedRoom = useGameStore((state) => state.hasCreatedRoom);
  const shadowsEnabled = useGameStore((state) => state.shadowsEnabled);
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
      <div className={`relative w-full h-full ${hasCreatedRoom && cameraLockMode ? "cursor-none" : ""}`}>
        <Canvas 
          shadows={shadowsEnabled}
          className="w-full h-full"
          camera={{ position: [0, 6.5, -5] }}
          gl={{
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.7,
          }}
        > 
          {/* need to wrap in Suspense because WorldShell has async loaders (like useGLTF) that can suspend (need to wait) */}
          <Suspense>
            <Physics debug={isDevMode} colliders="cuboid" gravity={[0, -9.81, 0]}>
              {hasCreatedRoom ? <WorldShell /> : <LandingPresentationLayer />}
            </Physics>
          </Suspense>

        </Canvas>
        
        {hasCreatedRoom ? <GameOverlay /> : <Landing />}
      </div>
    
  )
}

export default App
