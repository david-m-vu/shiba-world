/**
 *  character facing logic.
 */

import { useMemo, useRef } from "react";
import { Quaternion, Vector3 } from "three";
import { EPSILON, TURN_SPEED } from "../constants/playerControls.js";

const UP = new Vector3(0, 1, 0);

// calculate the shortest distance between two angles in radians
// adding then subtracting pi is a mathematical trick to recenter the number line so that the difference always stays within the range (-pi to pi)
    // (x + 180) % 360 = y % 360
    // x % 360 = (y - 180) % 360
// modding by 2pi forces any large angle like 720deg to fit back to 0deg
// the reason why we mod twice so negative numbers become positive after modding in javascript
const lerpAngle = (current, target, t) => {
    const TWO_PI = Math.PI * 2;
    const delta = (((target - current + Math.PI) % TWO_PI + TWO_PI) % TWO_PI) - Math.PI;

    // apply standard lerp formula
    return current + delta * t;
};

export const useAvatarRotation = () => {
    const tmpQuat = useMemo(() => new Quaternion(), []);
    const currentYawRef = useRef(0);

    const updateAvatarRotation = ({ rb, cameraLockMode, camForward, moveDir, delta }) => {
        if (cameraLockMode) {
            // if cameraLockMode, since avatar is always facing in the same direction, just get yaw from cam xz
            currentYawRef.current = Math.atan2(camForward.x, camForward.z);

        } else if (moveDir.lengthSq() > EPSILON) {
            const targetYaw = Math.atan2(moveDir.x, moveDir.z);
            currentYawRef.current = lerpAngle(
                currentYawRef.current,
                targetYaw,
                Math.min(1, TURN_SPEED * delta)
            );

        } else {
            return;
        }

        tmpQuat.setFromAxisAngle(UP, currentYawRef.current);
        rb.setRotation(
            { x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w },
            true
        );
    };

    return { updateAvatarRotation };
};
