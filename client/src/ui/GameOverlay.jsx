import Crosshair from "../components/ui/Crosshair.jsx";

import { useGameStore } from "../store/useGameStore.js";


const GameOverlay = () => {
    const cameraLockMode = useGameStore((state) => state.cameraLockMode);
    return (
        <div className="pointer-events-none absolute inset-0 z-10">
            {cameraLockMode && <Crosshair />}
        </div>
    )
}

export default GameOverlay
