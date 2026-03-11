/**
 * This file renders WorldShell on the R3F canvas
 */ 

import WorldShell from "./scenes/WorldShell.jsx";

import { Canvas } from "@react-three/fiber"


const App = () => {
  return (
    <div className="w-full h-full">
      <Canvas 
        shadows
        className="w-full h-full"
        camera={{ position: [0, 3, -5] }}
      > 
        <WorldShell/>
      </Canvas>
    </div>
  )
}

export default App
