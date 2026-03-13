/**
 *  lock/unlock camera follow behavior, yaw/pitch/distance sync.
 */

import { useMemo } from "react";
import { Vector3 } from "three";
import {
    CAMERA_LOCK_TARGET_Y_OFFSET,
    CAMERA_MAX_DISTANCE,
    CAMERA_MIN_DISTANCE,
    CAMERA_TARGET_Y_OFFSET,
    EPSILON,
} from "../constants/playerControls.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const useThirdPersonCamera = ({ initialPosition = [0, 0, 0] }) => {
    const targetDelta = useMemo(() => new Vector3(), []);
    const previousTarget = useMemo(() => new Vector3(...initialPosition), [initialPosition]);
    const cameraTarget = useMemo(() => new Vector3(), []);
    const cameraForward = useMemo(() => new Vector3(), []);

    const updateCamera = ({
        camera,
        controls, // this is the default orbital controls ref
        localPosition,
        cameraLockMode,
        cameraYawRef,
        cameraPitchRef,
        cameraDistanceRef,
    }) => {
        // Keep a dedicated target vector so we can offset look-at height without mutating localPosition.
        cameraTarget.copy(localPosition);
        cameraTarget.y += CAMERA_TARGET_Y_OFFSET;

        if (!controls) {
            return;
        }

        if (cameraLockMode) {
            const cosPitch = Math.cos(cameraPitchRef.current);
            cameraForward.set(
                Math.sin(cameraYawRef.current) * cosPitch,
                Math.sin(cameraPitchRef.current),
                Math.cos(cameraYawRef.current) * cosPitch
            );

            // redundant reclamping but but for safety
            cameraDistanceRef.current = clamp(
                cameraDistanceRef.current,
                CAMERA_MIN_DISTANCE,
                CAMERA_MAX_DISTANCE
            );

            // camera.position = target - forward * distance
            camera.position.copy(cameraTarget).addScaledVector(cameraForward, -cameraDistanceRef.current);
            camera.lookAt(cameraTarget);
            
            // to make sure orbital controls stays consistent when switched even while controls are dsiabled
            // so when you unlock, OrbitControls already has the correct target
            controls.target.copy(cameraTarget);
            previousTarget.copy(localPosition);
            return;
        }

        // ORBITCONTROLS
        targetDelta.subVectors(localPosition, previousTarget);
        camera.position.add(targetDelta);
        controls.target.copy(cameraTarget);
        controls.update();

        // Vector from camera to target; used to re-sync yaw/pitch/distance camera lock mode in orbit mode.
            // this way, when we switch back to camera lock mode, the the camera orientation will be synced
        // to get the vector from a (camera) pointing to b (cameraTarget), subtract b - a
        
        cameraForward.subVectors(cameraTarget, camera.position);
        const distance = cameraForward.length();
        if (distance > EPSILON) {
            cameraDistanceRef.current = clamp(distance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
            // Normalize so angle math uses only direction, not magnitude.
            cameraForward.multiplyScalar(1 / distance);
            cameraYawRef.current = Math.atan2(cameraForward.x, cameraForward.z);
            // Clamp for numerical safety since asin domain is [-1, 1].
            cameraPitchRef.current = Math.asin(clamp(cameraForward.y, -1, 1));
        }

        previousTarget.copy(localPosition);
    };

    return { updateCamera };
};
