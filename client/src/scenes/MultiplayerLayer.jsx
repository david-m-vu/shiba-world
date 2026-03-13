/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRapier } from "@react-three/rapier";
import { Quaternion, Vector3 } from "three";

import Avatar from "../components/Avatar.jsx";

import { useGameStore } from "../store/useGameStore.js";

const LOCAL_MOVE_SPEED = 12; // orig 8
const TURN_SPEED = 8;
const JUMP_IMPULSE = 6.5;
const HIDE_DISTANCE = 0.6;

const CAMERA_TARGET_Y_OFFSET = 0.8;
const CAMERA_MIN_DISTANCE = 0.3;
const CAMERA_MAX_DISTANCE = 100;
const CAMERA_WHEEL_ZOOM_SPEED = 0.0002; // 0.00042 is equal step distance
const POINTER_LOOK_SENSITIVITY = 0.005;
const POINTER_LOOK_MIN_PITCH = -Math.PI / 3;
const POINTER_LOOK_MAX_PITCH = Math.PI / 3;

const GROUND_RAY_OFFSET = 0.05;
const GROUND_RAY_LENGTH = 0.25;
const FOOT_RAY_RADIUS = 0.35;
const FOOT_RAY_OFFSETS = [
    [0, 0],
    [FOOT_RAY_RADIUS, FOOT_RAY_RADIUS],
    [FOOT_RAY_RADIUS, -FOOT_RAY_RADIUS],
    [-FOOT_RAY_RADIUS, FOOT_RAY_RADIUS],
    [-FOOT_RAY_RADIUS, -FOOT_RAY_RADIUS],
];

const localPlayer = {
    id: "local",
    position: [0, 5, 0],
    rotation: [0, 0, 0],
};

const tempRemotePlayers = [
    {
        id: "guest-1",
        position: [3, 0, 2],
        rotation: [0, -0.6, 0],
    },
];

// calculate the shortest distance between two angles in radians
// adding then subtracting pi is a mathematical trick to recenter the number line so that the difference always stays within the range (-pi to pi)
    // (x + 180) % 360 = y % 360
    // x % 360 = (y - 180) % 360
// modding by 2pi forces any large angle like 720deg to fit back to 0deg
// the reason why we mod twice so negative numbers become positive after modding in javascript
const lerpAngle = (current, target, t) => {
    const TWO_PI = Math.PI * 2;
    const delta = (((target - current + Math.PI) % (TWO_PI) + (TWO_PI)) % TWO_PI) - Math.PI;

    // apply standard lerp formula (current + (target - current) * alpha)
    return current + delta * t;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const MultiplayerLayer = () => {
    const { camera, gl } = useThree(); // gl is the underlying threejs WebGLRenderer
    const { rapier, world } = useRapier();

    const cameraLockMode = useGameStore((state) => state.cameraLockMode);

    const controlsRef = useRef(null);
    const localRigidBodyRef = useRef(null);
    const localVisualRef = useRef(null);

    const localPosition = useMemo(() => new Vector3(...localPlayer.position), []);
    const targetDelta = useMemo(() => new Vector3(), []);
    const previousTarget = useMemo(() => new Vector3(...localPlayer.position), []);

    const camForward = useMemo(() => new Vector3(), []); // movement facing direction, flattened y = 0 and normalized, used for WASD basis
    const camRight = useMemo(() => new Vector3(), []);
    const cameraTarget = useMemo(() => new Vector3(), []);
    const cameraForward = useMemo(() => new Vector3(), []); // full 3D camera direction, keeping vertical component, used for camera placement, not normalized
    const moveDir = useMemo(() => new Vector3(), []);
    const up = useMemo(() => new Vector3(0, 1, 0), []);
    const tmpQuat = useMemo(() => new Quaternion(), []);
    const jumpQueued = useRef(false);
    const currentYaw = useRef(0); // need to be a ref to persist across useFrame callss
    const groundRay = useMemo(
        () => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
        [rapier]
    );

    const keys = useRef({
        w: false,
        a: false,
        s: false,
        d: false,
    });

    // for cameraLockMode
    const cameraYaw = useRef(0);
    const cameraPitch = useRef(0);
    const cameraDistance = useRef(6);

    // detect which keys are preseed
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === "Space") {
                jumpQueued.current = true;
                return;
            }
            if (event.key === "Shift") {
                // event.repeat tells you if the event came from key auto-repeat
                // false only for the first keydown when key is initially pressed
                // true for subsequent keydown events while key is still held
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
            if (key in keys.current) {
                keys.current[key] = true;
            }
        };

        const handleKeyUp = (event) => {
            if (event.code === "Space") {
                return;
            }
            if (event.key === "Shift") {
                return;
            }
            const key = event.key.toLowerCase();
            if (key in keys.current) {
                keys.current[key] = false;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [gl]);

    // read relative mouse movement while pointer lock is active
    useEffect(() => {
        const handleMouseMove = (event) => {
            if (!cameraLockMode) {
                return;
            }
            // subtract because screen coords start from top left
            cameraYaw.current -= event.movementX * POINTER_LOOK_SENSITIVITY;
            cameraPitch.current -= event.movementY * POINTER_LOOK_SENSITIVITY;
            cameraPitch.current = clamp(cameraPitch.current, POINTER_LOOK_MIN_PITCH, POINTER_LOOK_MAX_PITCH);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [cameraLockMode]);

    // allow zoom in/out with mouse wheel while pointer lock mode is active
    useEffect(() => {
        const canvas = gl.domElement;

        const handleWheel = (event) => {
            if (!cameraLockMode) {
                return;
            }
            event.preventDefault();
            const zoomFactor = Math.exp(event.deltaY * CAMERA_WHEEL_ZOOM_SPEED);
            cameraDistance.current = clamp(
                cameraDistance.current * zoomFactor,
                CAMERA_MIN_DISTANCE,
                CAMERA_MAX_DISTANCE
            );
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener("wheel", handleWheel);
        };
    }, [cameraLockMode, gl]);

    useFrame((_state, delta) => {
        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }
        const currentPos = rb.translation(); // return rigid body's current world position as a vector
        const currentVel = rb.linvel();
        localPosition.set(currentPos.x, currentPos.y, currentPos.z);
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

        const inputX = (keys.current.d ? 1 : 0) - (keys.current.a ? 1 : 0);
        const inputZ = (keys.current.w ? 1 : 0) - (keys.current.s ? 1 : 0);

        // handle calculation of camForward for movement direction
        if (cameraLockMode) {
            // horizontal scale factor - when you look up/down more, horizontal strength should shrink
            const cosPitch = Math.cos(cameraPitch.current);
            // convert angles into 3D cartesion vector (direction)
            // at the horizon, cos(0) = 1 --> full strength in xz plane
            camForward.set(
                Math.sin(cameraYaw.current) * cosPitch,
                Math.sin(cameraPitch.current),
                Math.cos(cameraYaw.current) * cosPitch
            );
        } else {
            camera.getWorldDirection(camForward);
        }

        camForward.y = 0; // project onto xz plane

        if (camForward.lengthSq() > 0.0001) {
            camForward.normalize();
        } else {
            camForward.set(0, 0, -1);
        }
        camRight.copy(camForward).cross(up).normalize(); // if camForward is in the +z, camRight is in the -x

        moveDir.set(0, 0, 0);

        // calculate moveDir direction vector based on user input
        if (inputX !== 0 || inputZ !== 0) {
            moveDir
                .addScaledVector(camForward, inputZ)
                .addScaledVector(camRight, inputX);

            // to prevent normalizing a zero-length vector and to ignore near-zero vectors from floating-point noise of very tiny input
            if (moveDir.lengthSq() > 0.0001) {
                moveDir.normalize();
            }
        }

        // move with physics (keep current vertical velocity)
        if (moveDir.lengthSq() > 0.0001) {
            rb.setLinvel(
                {
                    x: moveDir.x * LOCAL_MOVE_SPEED,
                    y: currentVel.y,
                    z: moveDir.z * LOCAL_MOVE_SPEED,
                },
                true // wake is true so that body is forced to wake up if its at rest
            );
        } else { // if no direction vector, set xz velocity to 0
            rb.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true); 
        }

        // jump
        if (jumpQueued.current) {
            if (grounded) {
                rb.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true);
            }
            jumpQueued.current = false;
        }


        /*
         * update camera position with cameraForward
         */
        cameraTarget.copy(localPosition);
        cameraTarget.y += CAMERA_TARGET_Y_OFFSET;

        // if cameraLockMode, handle camera position
        if (controlsRef.current && cameraLockMode) {
            const cosPitch = Math.cos(cameraPitch.current);
            cameraForward.set( // unit vector at this point
                Math.sin(cameraYaw.current) * cosPitch,
                Math.sin(cameraPitch.current),
                Math.cos(cameraYaw.current) * cosPitch
            );

            // camera.position = target - cameraForward * distance
            camera.position.copy(cameraTarget).addScaledVector(cameraForward, -cameraDistance.current);
            camera.lookAt(cameraTarget);
            controlsRef.current.target.copy(cameraTarget);
            previousTarget.copy(localPosition);

        } else if (controlsRef.current) { // if no cameraLockMode
            // subtract new position from previous position --> this becomes the exact distance our camera also has to move
            targetDelta.subVectors(localPosition, previousTarget);
            camera.position.add(targetDelta);
            controlsRef.current.target.copy(cameraTarget);
            controlsRef.current.update();

            // compute the vector pointing from camera to target
            // to get a vector pointing from a (camera) to b (cameraTarget)
            cameraForward.subVectors(cameraTarget, camera.position);
            const distance = cameraForward.length();
            
            if (distance > 0.0001) {
                cameraDistance.current = clamp(distance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
                cameraForward.multiplyScalar(1 / distance); // normalize
                cameraYaw.current = Math.atan2(cameraForward.x, cameraForward.z);
                // clamp to prevent invalid values since asin is only defined for [-1, 1]
                cameraPitch.current = Math.asin(clamp(cameraForward.y, -1, 1));
            }

            previousTarget.copy(localPosition);
        }

        // handle avatar rotation
        if (cameraLockMode) { // if cameraLockMode, should have no lerp
            currentYaw.current = Math.atan2(camForward.x, camForward.z);
            tmpQuat.setFromAxisAngle(up, currentYaw.current); // rotate about the y axis
            rb.setRotation(
                { x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w },
                true
            );

        } else if (moveDir.lengthSq() > 0.0001) {
            // const targetYaw = cameraLockMode
            //     ? Math.atan2(camForward.x, camForward.z)
            //     : Math.atan2(moveDir.x, moveDir.z);
            const targetYaw = Math.atan2(moveDir.x, moveDir.z); // find out what angle we're looking at relative to the +z
            currentYaw.current = lerpAngle(
                currentYaw.current,
                targetYaw,
                Math.min(1, TURN_SPEED * delta)
            );
            tmpQuat.setFromAxisAngle(up, currentYaw.current); // rotate about the y axis
            rb.setRotation(
                { x: tmpQuat.x, y: tmpQuat.y, z: tmpQuat.z, w: tmpQuat.w },
                true
            );
        }

        // handle avatar visibility
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
                maxDistance={CAMERA_MAX_DISTANCE} // orig 25
                enablePan={false}
            />

            <Avatar
                position={localPlayer.position}
                rotation={localPlayer.rotation}
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
