/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRapier } from "@react-three/rapier";
import { Euler, Quaternion } from "three";

import Avatar from "../components/Avatar.jsx";
import RemoteAvatar from "../components/RemoteAvatar.jsx";

import { useGameStore } from "../store/useGameStore.js";
import { useRemotePlayers } from "../hooks/useRemotePlayers.js";
import {
    HIDE_DISTANCE,
    CAMERA_MIN_DISTANCE,
    CAMERA_MAX_DISTANCE,
    INITIAL_WORLD_CAMERA_POSITION,
} from "../constants/playerControls.js";
import { usePlayerInput } from "../hooks/usePlayerInput.js";
import { usePlayerMovement } from "../hooks/usePlayerMovement.js";
import { useThirdPersonCamera } from "../hooks/useThirdPersonCamera.js";
import { useAvatarRotation } from "../hooks/useAvatarRotation.js";

import { getShortestAngleDelta } from "../lib/util.js";

const LOCAL_PLAYER_DEFAULT_POSITION = [0, 5, 0];
const LOCAL_PLAYER_DEFAULT_ROTATION = [0, 0, 0];

const PLAYER_SYNC_INTERVAL_MS = 66;
const PLAYER_SYNC_POSITION_EPSILON = 0.02;
const PLAYER_SYNC_ROTATION_EPSILON = 0.03;

const MultiplayerLayer = () => {
    const { camera, gl } = useThree();
    const { rapier, world } = useRapier();

    const cameraLockMode = useGameStore((state) => state.cameraLockMode);
    const infiniteJumpEnabled = useGameStore((state) => state.infiniteJumpEnabled);
    const resetCharacterRequestId = useGameStore((state) => state.resetCharacterRequestId);
    const selfPlayerId = useGameStore((state) => state.selfPlayerId);
    const localPlayerName = useGameStore((state) => {
        // prioritize using the server0synced source of truth for player name
        // localPlayerName is used as a fallback for early frames before self player record exists
        const selfId = state.selfPlayerId;
        if (selfId && state.playersById[selfId]?.name) {
            return state.playersById[selfId].name;
        }

        return state.localPlayerName || "Anonymous";
    });
    const sendPlayerUpdate = useGameStore((state) => state.sendPlayerUpdate);

    const remotePlayers = useRemotePlayers();

    const initialLocalStateRef = useRef(null); // useRef to keep it stable for the lifetime of this MultiplayerLayer mount
    if (!initialLocalStateRef.current) { // initialize initialLocalStateRef only once
        const state = useGameStore.getState();
        const selfPlayer = state.selfPlayerId ? state.playersById[state.selfPlayerId] : null;
        initialLocalStateRef.current = {
            position: [...(selfPlayer?.position ?? LOCAL_PLAYER_DEFAULT_POSITION)],
            rotation: [...(selfPlayer?.rotation ?? LOCAL_PLAYER_DEFAULT_ROTATION)],
        };
    }

    const localPlayerInitialPosition = initialLocalStateRef.current.position;
    const localPlayerInitialRotation = initialLocalStateRef.current.rotation;
    const localPlayerInitialQuaternion = useMemo(() => {
        return new Quaternion().setFromEuler(new Euler(...localPlayerInitialRotation));
    }, [localPlayerInitialRotation]);

    const controlsRef = useRef(null);
    const localRigidBodyRef = useRef(null); 
    const localVisualRef = useRef(null); // used to hide avatar object when camera gets too close

    const syncQuatRef = useRef(new Quaternion());
    // yxz because we only care about yaw for player facing sync. YXZ makes yaw extraction more stable when there's small pitch/roll noise from physics
    // in short, rotating around y first in the math order makes it more reliable
    const syncEulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
    // stores the last player state you already emitted to the server: { sentAtMs, position, rotation }
    // uses every frame to decide: has enough time passed (PLAYER_SYNC_INTERVAL_MS), and did position/rotation change past epsilon threshold before calling sendPlayerUpdate
    // also updates on null
    const lastSentStateRef = useRef(null); 

    // get hooks for player / camera movement 
    const {
        keysRef,
        jumpQueuedRef,
        cameraYawRef,
        cameraPitchRef,
        cameraDistanceRef,
    } = usePlayerInput({ gl, cameraLockMode });
    
    const { localPosition, camForward, moveDir, updateMovement } = usePlayerMovement({
        rapier,
        initialPosition: localPlayerInitialPosition,
    });

    const { updateCamera } = useThirdPersonCamera({
        initialPosition: localPlayerInitialPosition,
    });

    const { updateAvatarRotation } = useAvatarRotation();

    // Reset camera each time MultiplayerLayer mounts (join room transition).
    useEffect(() => {
        const [cameraX, cameraY, cameraZ] = INITIAL_WORLD_CAMERA_POSITION;
        const [targetX, targetY, targetZ] = localPlayerInitialPosition;

        camera.position.set(cameraX, cameraY, cameraZ);

        if (controlsRef.current) {
            controlsRef.current.target.set(targetX, targetY, targetZ);
            controlsRef.current.update();
            return;
        }

        camera.lookAt(targetX, targetY, targetZ);
    }, [camera, localPlayerInitialPosition]);

    // reset avatar position, velocity, angular velocity if resetCharacterRequestId changes
    useEffect(() => {
        if (resetCharacterRequestId === 0) {
            return;
        }

        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }

        const [x, y, z] = localPlayerInitialPosition;
        rb.setTranslation({ x, y, z }, true);
        rb.setRotation(localPlayerInitialQuaternion, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        sendPlayerUpdate({
            position: [x, y, z],
            rotation: localPlayerInitialRotation,
        });
        lastSentStateRef.current = null; // set to null on character reset so the next frame sends a fresh immediate update

        localPosition.set(x, y, z);
    }, [
        localPlayerInitialPosition,
        localPlayerInitialQuaternion,
        localPlayerInitialRotation,
        localPosition,
        resetCharacterRequestId,
        sendPlayerUpdate,
    ]);

    useFrame((state, delta) => {
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
            infiniteJumpEnabled,
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

        if (!selfPlayerId) {
            return;
        }

        const rawPosition = rb.translation();
        const rawRotation = rb.rotation();
        const syncQuat = syncQuatRef.current;
        const syncEuler = syncEulerRef.current;

        syncQuat.set(rawRotation.x, rawRotation.y, rawRotation.z, rawRotation.w);
        // yxz because we only care about yaw for player facing sync. YXZ makes yaw extraction more stable when there's small pitch/roll noise from physics
        // in short, rotating around y first in the math order makes it more reliable
        syncEuler.setFromQuaternion(syncQuat, "YXZ"); 

        const nextPosition = [rawPosition.x, rawPosition.y, rawPosition.z];
        const nextRotation = [0, syncEuler.y, 0];
        const nowMs = state.clock.elapsedTime * 1000;
        const previousState = lastSentStateRef.current;

        if (!previousState) {
            sendPlayerUpdate({
                position: nextPosition,
                rotation: nextRotation,
            });
            lastSentStateRef.current = {
                sentAtMs: nowMs,
                position: nextPosition,
                rotation: nextRotation,
            };
            return;
        }

        // if the time between sendPlayerUpdate is not at least PLAYER_SYNC_INTERVAL_MS, skip sending player update
        if (nowMs - previousState.sentAtMs < PLAYER_SYNC_INTERVAL_MS) {
            return;
        }

        const didMove = Math.hypot(
            nextPosition[0] - previousState.position[0],
            nextPosition[1] - previousState.position[1],
            nextPosition[2] - previousState.position[2]
        ) > PLAYER_SYNC_POSITION_EPSILON;

        const didRotate = Math.abs(getShortestAngleDelta(previousState.rotation[1], nextRotation[1])) > PLAYER_SYNC_ROTATION_EPSILON;

        if (!didMove && !didRotate) {
            return;
        }

        sendPlayerUpdate({
            position: nextPosition,
            rotation: nextRotation,
        });

        lastSentStateRef.current = {
            sentAtMs: nowMs,
            position: nextPosition,
            rotation: nextRotation,
        };
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
                position={localPlayerInitialPosition}
                rotation={localPlayerInitialRotation}
                playerName={localPlayerName}
                usePhysics
                rigidBodyRef={localRigidBodyRef}
                rigidBodyProps={{
                    colliders: false,
                    enabledRotations: [false, true, false], // controls which axes the rigid body is allowed to rotate around
                    gravityScale: 1,
                }}
                colliderProps={{
                    // Capsule args: [halfHeight, radius]. Rotate 90deg on X so the long axis runs along local Z.
                    // z size = 2(halfHeight + radius)
                    // position.z = model z midpoint
                    // position.y --> collider y midpoint - radius = 0
                    args: [0.44, 0.45],
                    position: [0, 0.45, 0], // keep capsule bottom near y=0 and center it on the shiba body
                    rotation: [Math.PI / 2, 0, 0],
                }}
                visualRef={localVisualRef}
            />

            {remotePlayers.map((player) => (
                <RemoteAvatar key={player.id} player={player} />
            ))}
        </>
    )
}

export default MultiplayerLayer
