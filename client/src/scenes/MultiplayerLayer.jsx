/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRapier } from "@react-three/rapier";
import Avatar from "../components/Avatar.jsx";
import { useGameStore } from "../store/useGameStore.js";
import { HIDE_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE } from "../constants/playerControls.js";
import { usePlayerInput } from "../hooks/usePlayerInput.js";
import { usePlayerMovement } from "../hooks/usePlayerMovement.js";
import { useThirdPersonCamera } from "../hooks/useThirdPersonCamera.js";
import { useAvatarRotation } from "../hooks/useAvatarRotation.js";

const localPlayer = {
    id: "local",
    initialPosition: [0, 5, 0],
    initialRotation: [0, 0, 0],
};

const tempRemotePlayers = [
    {
        id: "guest-1",
        position: [3, 0, 2],
        rotation: [0, -0.6, 0],
    },
];

const MultiplayerLayer = () => {
    const { camera, gl } = useThree();
    const { rapier, world } = useRapier();
    const cameraLockMode = useGameStore((state) => state.cameraLockMode);

    const controlsRef = useRef(null);
    const localRigidBodyRef = useRef(null);
    const localVisualRef = useRef(null);

    const {
        keysRef,
        jumpQueuedRef,
        cameraYawRef,
        cameraPitchRef,
        cameraDistanceRef,
    } = usePlayerInput({ gl, cameraLockMode });
    
    const { localPosition, camForward, moveDir, updateMovement } = usePlayerMovement({
        rapier,
        initialPosition: localPlayer.initialPosition,
    });

    const { updateCamera } = useThirdPersonCamera({
        initialPosition: localPlayer.initialPosition,
    });

    const { updateAvatarRotation } = useAvatarRotation();

    useFrame((_state, delta) => {
        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }
        updateMovement({
            rb,
            world,
            camera,
            cameraLockMode,
            keysRef,
            jumpQueuedRef,
            cameraYawRef,
            cameraPitchRef,
        });
        updateCamera({
            camera,
            controls: controlsRef.current,
            localPosition,
            cameraLockMode,
            cameraYawRef,
            cameraPitchRef,
            cameraDistanceRef,
        });
        updateAvatarRotation({
            rb,
            cameraLockMode,
            camForward,
            moveDir,
            delta,
        });

        if (localVisualRef.current) {
            localVisualRef.current.visible = camera.position.distanceTo(localPosition) > HIDE_DISTANCE;
        }
    });

    return (
        <>
            <OrbitControls
                ref={controlsRef}
                enabled={!cameraLockMode}
                enableDamping
                dampingFactor={0.08}
                minDistance={CAMERA_MIN_DISTANCE}
                maxDistance={CAMERA_MAX_DISTANCE}
                enablePan={false}
            />

            <Avatar
                position={localPlayer.initialPosition}
                rotation={localPlayer.initialRotation}
                usePhysics
                rigidBodyRef={localRigidBodyRef}
                rigidBodyProps={{
                    colliders: "cuboid",
                    enabledRotations: [false, true, false], // controls which axes the rigid body is allowed to rotate around
                    gravityScale: 1
                }}
                visualRef={localVisualRef}
            />

            {tempRemotePlayers.map((player) => (
                <Avatar
                    key={player.id}
                    position={player.position}
                    rotation={player.rotation}
                />
            ))}
        </>
    )
}

export default MultiplayerLayer
