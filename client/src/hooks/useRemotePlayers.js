/**
 * This hook should handle remote player position/rotation
 */

import { useShallow } from "zustand/react/shallow";

import { useGameStore } from "../store/useGameStore.js";

export const useRemotePlayers = () => {
    // useShallow is a zustand helper that prevents unnecessary rerenders for selector results like arrays/objects
    // since the .filter creates a new array every time
    // without useShallow, React sees a new reference and rerenders even if contents didn't really change
    // with useShallow, zustand does a shallow compare of the new results vs previous result to determine rerenders
    // note thought that if each player's object reference are still the same, it consideres result equal, even though nested data changed
        // this is ok though becauase we treat our selfPlayerId map as immutable, and create new references every time we update a player

    return useGameStore(useShallow((state) => {
        const selfPlayerId = state.selfPlayerId;

        // return all the player objects except for the current player
        return Object.values(state.playersById).filter((player) => {
            return player.id && player.id !== selfPlayerId;
        });
    }));
};
