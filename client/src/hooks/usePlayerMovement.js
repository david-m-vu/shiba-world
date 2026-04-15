/**
 *  grounded checks, move vector, velocity/jump physics.
 */

import { useMemo } from "react";
import { Vector3 } from "three";
import {
    EPSILON,
    FOOT_RAY_OFFSETS,
    GROUND_RAY_LENGTH,
    GROUND_RAY_OFFSET,
    JUMP_IMPULSE,
    LOCAL_MOVE_SPEED,
} from "../constants/playerControls.js";
import { useGameStore } from "../store/useGameStore.js"

export const usePlayerMovement = ({ rapier, initialPosition = [0, 0, 0] }) => {    
    const playJumpSound = useGameStore((state) => state.playJumpSound);
    
    const localPosition = useMemo(() => new Vector3(...initialPosition), [initialPosition]);
    const camForward = useMemo(() => new Vector3(), []);
    const camRight = useMemo(() => new Vector3(), []);
    const moveDir = useMemo(() => new Vector3(), []);
    const up = useMemo(() => new Vector3(0, 1, 0), []);
    const groundRay = useMemo(
        () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
        [rapier]
    );

    const updateMovement = ({
        rb,
        world,
        camera,
        cameraLockMode,
        keysRef,
        jumpQueuedRef,
        cameraYawRef,
        cameraPitchRef,
        infiniteJumpEnabled = false,
    }) => {
        const currentPos = rb.translation(); // current rigid body's world position
        const currentVel = rb.linvel();
        localPosition.set(currentPos.x, currentPos.y, currentPos.z); // sync non-physics localPosition

        // Cast multiple short downward rays around the avatar's feet for robust grounded checks.
        let grounded = false;
        for (let i = 0; i < FOOT_RAY_OFFSETS.length; i += 1) {
            const [offsetX, offsetZ] = FOOT_RAY_OFFSETS[i];
            groundRay.origin.x = currentPos.x + offsetX;
            groundRay.origin.y = currentPos.y + GROUND_RAY_OFFSET;
            groundRay.origin.z = currentPos.z + offsetZ;
            const hit = world.castRay(groundRay, GROUND_RAY_LENGTH, true, undefined, undefined, undefined, rb);
            if (hit) {
                grounded = true;
                break;
            }
        }

        const inputX = (keysRef.current.d ? 1 : 0) - (keysRef.current.a ? 1 : 0);
        const inputZ = (keysRef.current.w ? 1 : 0) - (keysRef.current.s ? 1 : 0);

        // calculate camForward, which will determine where the camera is facing --> used to determine movement direction
        if (cameraLockMode) {
            // Convert yaw/pitch into a forward direction vector.
            // horizontal scale factor - when you look up/down more, horizontal strength should shrink
            const cosPitch = Math.cos(cameraPitchRef.current);
            
            // convert angles into 3D cartesion vector (direction)
            // at the horizon, cos(0) = 1 --> full strength in xz plane
            camForward.set(
                Math.sin(cameraYawRef.current) * cosPitch,
                Math.sin(cameraPitchRef.current),
                Math.cos(cameraYawRef.current) * cosPitch
            );
        } else {
            camera.getWorldDirection(camForward);
        }

        camForward.y = 0;
        if (camForward.lengthSq() > EPSILON) {
            camForward.normalize();
        } else {
            camForward.set(0, 0, -1);
        }

        // Build right-vector basis from forward x up for camera-relative strafing, then calculate moveDir for default camera controls
        camRight.copy(camForward).cross(up).normalize();

        moveDir.set(0, 0, 0);
        if (inputX !== 0 || inputZ !== 0) {
            moveDir.addScaledVector(camForward, inputZ).addScaledVector(camRight, inputX);
            if (moveDir.lengthSq() > EPSILON) {
                moveDir.normalize();
            }
        }

        // set linear velocity of rigid body based on moveDir
        if (moveDir.lengthSq() > EPSILON) {
            rb.setLinvel(
                {
                    x: moveDir.x * LOCAL_MOVE_SPEED,
                    y: currentVel.y,
                    z: moveDir.z * LOCAL_MOVE_SPEED,
                },
                true
            );
        } else {
            rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
        }

        // Queue jump on key press and consume it once per frame.
        if (jumpQueuedRef.current) {
            if (grounded || infiniteJumpEnabled) {
                rb.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true);
                playJumpSound();
            }
            jumpQueuedRef.current = false;
        }
    };

    return {
        localPosition,
        camForward,
        moveDir,
        updateMovement,
    };
};
