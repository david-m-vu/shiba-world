/**
 * Scene wrapper to be rendered in Canvas. Consists of SharedEnvironment, LandingPresentationLayer, and MultiplayerLayer, depending on user join state
 */

import SharedEnvironment from "./SharedEnvironment.jsx";
import MultiplayerLayer from "./MultiplayerLayer.jsx";
import { useGameStore } from "../store/useGameStore.js";

const isDevMode = import.meta.env.VITE_DEV_MODE === "true"

const WorldShell = () => {
    const sunsetMode = useGameStore((state) => state.sunsetMode);
    const shadowsEnabled = useGameStore((state) => state.shadowsEnabled);

    return (
        <>
            <MultiplayerLayer />
            <SharedEnvironment
                debug={isDevMode}
                isSunset={sunsetMode}
                useOceanShaders={false}
                shadowsEnabled={shadowsEnabled}
            />
        </>
    )
}

export default WorldShell;
