/**
 * This file renders WorldShell on the R3F canvas
 */

import WorldShell from "./scenes/WorldShell.jsx";
import { useEffect } from "react";
import { Suspense } from 'react';
import { Canvas } from "@react-three/fiber"
import { ACESFilmicToneMapping } from "three";
import { Physics } from "@react-three/rapier";
import GameOverlay from "./ui/GameOverlay.jsx";

import { useGameStore } from "./store/useGameStore.js";

const App = () => {
  const cameraLockMode = useGameStore((state) => state.cameraLockMode);
  const setCameraLockMode = useGameStore((state) => state.setCameraLockMode);

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
    <div className={`relative w-full h-full ${cameraLockMode ? "cursor-none" : ""}`}>
      <Canvas 
        shadows
        className="w-full h-full"
        camera={{ position: [0, 6.5, -5] }}
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 0.7,
        }}
      > 
        <Suspense>
          <Physics debug colliders="cuboid" gravity={[0, -9.81, 0]}>
            <WorldShell />
          </Physics>
        </Suspense>

      </Canvas>
      <GameOverlay />
    </div>
  )
}

export default App
