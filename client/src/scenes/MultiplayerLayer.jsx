/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRapier } from "@react-three/rapier";
import { Euler, Quaternion, Vector3 } from "three";

import Avatar from "../components/Avatar.jsx";
import RemoteAvatar from "../components/RemoteAvatar.jsx";
import InteractHint from "../components/InteractHint.jsx";

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
import { isEditableElement } from "../lib/dom.js";

const LOCAL_PLAYER_DEFAULT_POSITION = [0, 5, 0];
const LOCAL_PLAYER_DEFAULT_ROTATION = [0, 0, 0];

const PLAYER_SYNC_INTERVAL_MS = 66;
const PLAYER_SYNC_POSITION_EPSILON = 0.02;
const PLAYER_SYNC_ROTATION_EPSILON = 0.03;

const KIOSK_INTERACT_RADIUS = 2.25;
const KIOSK_INTERACT_POSITION = [0, 0, 3];
const KIOSK_HINT_Y = 2.25;

const WATCH_CAMERA_POSITION = [0, 15, -8]; // orig 0,15,3
const WATCH_CAMERA_TARGET = [0, 0, 20]; // orig 0,10,30
const WATCH_CAMERA_LERP_SPEED = 2;
const WATCH_CAMERA_BACK_LERP_SPEED = 15;

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
    const localActiveMessage = useGameStore((state) => {
        const selfId = state.selfPlayerId;
        if (!selfId) {
            return "";
        }

        return String(state.playersById[selfId]?.activeMessage ?? "");
    });
    const sendPlayerUpdate = useGameStore((state) => state.sendPlayerUpdate);
    const watchTogetherOpen = useGameStore((state) => state.watchTogetherOpen);
    const openWatchTogether = useGameStore((state) => state.openWatchTogether);

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
    const isNearKioskRef = useRef(false);
    const [isNearKiosk, setIsNearKiosk] = useState(false);

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
    const watchCameraPositionRef = useMemo(() => new Vector3(...WATCH_CAMERA_POSITION), []);
    const watchCameraTargetRef = useMemo(() => new Vector3(...WATCH_CAMERA_TARGET), []);
    const watchLookTargetRef = useMemo(() => new Vector3(...WATCH_CAMERA_TARGET), []);
    const preWatchCameraPositionRef = useMemo(() => new Vector3(), []);
    const preWatchCameraTargetRef = useMemo(() => new Vector3(), []);
    const wasWatchTogetherOpenRef = useRef(false); // stores the previous frame/effect value of watchTogetherOpen and lets us detect transitions
    const shouldReturnToPreWatchCameraRef = useRef(false); // set to true when WatchTogether closes, useFrame sees and lerps, then eventually set back to false

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

    // useEffect to register interact with E for watch2gether
    useEffect(() => {
        const handleInteractKeyDown = (event) => {
            // event.repeat is a keyboard event flag that becomes true when the keydown is auto-firing because the key is being held down
            if (watchTogetherOpen || event.repeat) {
                return;
            }

            const key = String(event.key ?? "").toLowerCase();
            // use code for when keyboard has a different layout where the physical key types another letter, but physucal position is still at KeyE
            if (event.code !== "KeyE" && key !== "e") {
                return;
            }

            if (!isNearKioskRef.current) {
                return;
            }

            if (isEditableElement(document.activeElement)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            if (document.pointerLockElement) {
                try {
                    document.exitPointerLock();
                } catch {
                    // no-op
                }
            }

            openWatchTogether();
        };

        window.addEventListener("keydown", handleInteractKeyDown, true);
        return () => {
            window.removeEventListener("keydown", handleInteractKeyDown, true);
        };
    }, [openWatchTogether, watchTogetherOpen]);

    // when watchTogether UI is opened, stop player from moving
    useEffect(() => {
        if (!watchTogetherOpen) {
            return;
        }

        // Clear movement intent while the panel is open so key-hold state does not leak on close.
        keysRef.current.w = false;
        keysRef.current.a = false;
        keysRef.current.s = false;
        keysRef.current.d = false;
        jumpQueuedRef.current = false;

        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }

        // Stop horizontal movement but keep vertical gravity/fall behavior unchanged.
        const linearVelocity = rb.linvel();
        rb.setLinvel({ x: 0, y: linearVelocity.y, z: 0 }, true);
    }, [jumpQueuedRef, keysRef, watchTogetherOpen]);

    useEffect(() => {
        // if watch together is open but it wasn't before (open)
        if (watchTogetherOpen && !wasWatchTogetherOpenRef.current) {
            // Snapshot camera pose before entering watch mode.
            preWatchCameraPositionRef.copy(camera.position);

            if (controlsRef.current) {
                preWatchCameraTargetRef.copy(controlsRef.current.target);
            } else { // default to setting target at screen
                preWatchCameraTargetRef.copy(watchCameraTargetRef);
            }

            shouldReturnToPreWatchCameraRef.current = false;
        }

        // if watch together wasn't open and it was open before (close)
        if (!watchTogetherOpen && wasWatchTogetherOpenRef.current) {
            // Start return transition when watch mode closes.
            shouldReturnToPreWatchCameraRef.current = true;
        }

        wasWatchTogetherOpenRef.current = watchTogetherOpen;
    }, [camera, watchCameraTargetRef, watchTogetherOpen, preWatchCameraPositionRef, preWatchCameraTargetRef]);

    useFrame((state, delta) => {
        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }

        const isMovementLocked = watchTogetherOpen || shouldReturnToPreWatchCameraRef.current;

        if (isMovementLocked) {
            // Keep input and horizontal velocity neutral while watch mode is open
            // and while camera is returning to the pre-watch pose.
            keysRef.current.w = false;
            keysRef.current.a = false;
            keysRef.current.s = false;
            keysRef.current.d = false;
            jumpQueuedRef.current = false;

            const linearVelocity = rb.linvel();
            rb.setLinvel({ x: 0, y: linearVelocity.y, z: 0 }, true);
        }

        if (!isMovementLocked) {
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
        }

        if (controlsRef.current) {
            controlsRef.current.enabled = !cameraLockMode && !watchTogetherOpen && !shouldReturnToPreWatchCameraRef.current;
        }

        if (watchTogetherOpen) {
            const lerpAlpha = Math.min(1, delta * WATCH_CAMERA_LERP_SPEED);
            camera.position.lerp(watchCameraPositionRef, lerpAlpha);
            watchLookTargetRef.lerp(watchCameraTargetRef, lerpAlpha);
            camera.lookAt(watchLookTargetRef);

            // to keep OrbitControls internal state synced with the camera target
            if (controlsRef.current) {
                controlsRef.current.target.copy(watchLookTargetRef);
                controlsRef.current.update();
            }
        } else if (shouldReturnToPreWatchCameraRef.current) {
            const lerpAlpha = Math.min(1, delta * WATCH_CAMERA_BACK_LERP_SPEED);
            camera.position.lerp(preWatchCameraPositionRef, lerpAlpha);
            
            // basically lerp look-at target point from watchLookTarget to previous camera look at
            watchLookTargetRef.lerp(preWatchCameraTargetRef, lerpAlpha);
            camera.lookAt(watchLookTargetRef);

            if (controlsRef.current) {
                controlsRef.current.target.copy(watchLookTargetRef);
                controlsRef.current.update();
            }

            // snap to previous positions and look ats once lerp has reached a certain distance to original position
            // then finally set shouldReturnToPreWatchCameraRef to false
            const isPositionSettled = camera.position.distanceToSquared(preWatchCameraPositionRef) < 0.01;
            const isTargetSettled = watchLookTargetRef.distanceToSquared(preWatchCameraTargetRef) < 0.01;
            if (isPositionSettled && isTargetSettled) {
                camera.position.copy(preWatchCameraPositionRef);
                watchLookTargetRef.copy(preWatchCameraTargetRef);
                camera.lookAt(watchLookTargetRef);
                if (controlsRef.current) {
                    controlsRef.current.target.copy(watchLookTargetRef);
                    controlsRef.current.update();
                }
                shouldReturnToPreWatchCameraRef.current = false;
            }
        } else {
            updateCamera({
                camera,
                controls: controlsRef.current,
                localPosition,
                cameraLockMode,
                cameraYawRef,
                cameraPitchRef,
                cameraDistanceRef,
            });
        }
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

        const deltaX = localPosition.x - KIOSK_INTERACT_POSITION[0];
        const deltaZ = localPosition.z - KIOSK_INTERACT_POSITION[2];
        const nearKioskNow = Math.hypot(deltaX, deltaZ) <= KIOSK_INTERACT_RADIUS;
        const wasNearKiosk = isNearKioskRef.current;
        isNearKioskRef.current = nearKioskNow;

        // if avatar is near the kiosk (nearKioskNow) but previously wasn't (wasNearKiosk), update isNearKiosk state to trigger rerender
        if (wasNearKiosk !== nearKioskNow) {
            setIsNearKiosk(nearKioskNow);
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
                enabled={!cameraLockMode && !watchTogetherOpen}
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
                activeMessage={localActiveMessage}
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

            {isNearKiosk ? (
                <InteractHint 
                    position={[KIOSK_INTERACT_POSITION[0], KIOSK_HINT_Y, KIOSK_INTERACT_POSITION[2]]}
                    text={"Press E to open Watch_3_Gether"}
                />
            ) : null}
        </>
    )
}

export default MultiplayerLayer
