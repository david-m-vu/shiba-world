/**
 * This file renders WorldShell on the R3F canvas
 */

import WorldShell from "./scenes/WorldShell.jsx";
import { Suspense } from 'react';
import { Canvas } from "@react-three/fiber"
import { Physics } from "@react-three/rapier";



const App = () => {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        className="w-full h-full"
        camera={{ position: [0, 3, -5] }}
      >
        <Suspense>
          <Physics debug colliders="cuboid" gravity={[0, -9.81, 0]}>
            <WorldShell />
          </Physics>
        </Suspense>

      </Canvas>
    </div>
  )
}

export default App
