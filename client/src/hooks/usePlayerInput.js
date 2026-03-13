/**
 * keyboard, shift pointer-lock toggle, mouse look, wheel zoom.
 */

import { useEffect, useRef } from "react";
import {
    CAMERA_MAX_DISTANCE,
    CAMERA_MIN_DISTANCE,
    CAMERA_WHEEL_ZOOM_SPEED,
    INITIAL_CAMERA_DISTANCE,
    POINTER_LOOK_MAX_PITCH,
    POINTER_LOOK_MIN_PITCH,
    POINTER_LOOK_SENSITIVITY,
} from "../constants/playerControls.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const usePlayerInput = ({ gl, cameraLockMode }) => {
    const keysRef = useRef({
        w: false,
        a: false,
        s: false,
        d: false,
    });
    const jumpQueuedRef = useRef(false);
    const cameraYawRef = useRef(0);
    const cameraPitchRef = useRef(0);
    const cameraDistanceRef = useRef(INITIAL_CAMERA_DISTANCE);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === "Space") {
                jumpQueuedRef.current = true;
                return;
            }

            if (event.key === "Shift") {
                // event.repeat is true for auto-repeat while key is held.
                // We only toggle pointer lock on the first keydown.
                if (!event.repeat) {
                    const canvas = gl.domElement;
                    if (document.pointerLockElement === canvas) {
                        document.exitPointerLock();
                    } else {
                        canvas.requestPointerLock();
                    }
                }
                return;
            }

            const key = event.key.toLowerCase();
            if (key in keysRef.current) {
                keysRef.current[key] = true;
            }
        };

        const handleKeyUp = (event) => {
            if (event.code === "Space" || event.key === "Shift") {
                return;
            }

            const key = event.key.toLowerCase();
            if (key in keysRef.current) {
                keysRef.current[key] = false;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [gl]);

    // handle mouse move when camera is lockde
    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!cameraLockMode) {
                return;
            }

            // movementX/Y are relative deltas from pointer lock.
            // Subtract Y so mouse-up maps to looking up.
            cameraYawRef.current -= event.movementX * POINTER_LOOK_SENSITIVITY;
            cameraPitchRef.current -= event.movementY * POINTER_LOOK_SENSITIVITY;
            cameraPitchRef.current = clamp(
                cameraPitchRef.current,
                POINTER_LOOK_MIN_PITCH,
                POINTER_LOOK_MAX_PITCH
            );
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [cameraLockMode]);

    // handle scroll wheel when camera is locked
    useEffect(() => {
        const canvas = gl.domElement;
        const handleWheel = (event) => {
            if (!cameraLockMode) {
                return;
            }

            event.preventDefault();
            // Exponential scaling gives smooth proportional zoom steps.
            const zoomFactor = Math.exp(event.deltaY * CAMERA_WHEEL_ZOOM_SPEED);
            cameraDistanceRef.current = clamp(
                cameraDistanceRef.current * zoomFactor,
                CAMERA_MIN_DISTANCE,
                CAMERA_MAX_DISTANCE
            );
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener("wheel", handleWheel);
        };
    }, [cameraLockMode, gl]);

    return {
        keysRef,
        jumpQueuedRef,
        cameraYawRef,
        cameraPitchRef,
        cameraDistanceRef,
    };
};
