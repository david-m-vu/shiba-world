/**
 * Scene wrapper to be rendered in Canvas. Consists of SharedEnvironment, LandingPresentationLayer, and MultiplayerLayer, depending on user join state
 */

import SharedEnvironment from "./SharedEnvironment.jsx";
import MultiplayerLayer from "./MultiplayerLayer.jsx";


const isDevMode = import.meta.env.VITE_DEV_MODE === "true"

const WorldShell = () => {
    return (
        <>
            <MultiplayerLayer />
            <SharedEnvironment debug={isDevMode} isSunset />
        </>
    )
}

export default WorldShell;