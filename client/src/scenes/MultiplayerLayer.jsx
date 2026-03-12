/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Quaternion, Vector3 } from "three";
import Avatar from "../components/Avatar.jsx";

const LOCAL_MOVE_SPEED = 12; // orig 8
const HIDE_DISTANCE = 0.6;
const TURN_SPEED = 8;
const JUMP_IMPULSE = 6.5;
const GROUND_Y = 10;

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

const MultiplayerLayer = () => {
    const { camera } = useThree();
    const controlsRef = useRef(null);
    const localRigidBodyRef = useRef(null);
    const localVisualRef = useRef(null);

    const localPosition = useMemo(() => new Vector3(...localPlayer.position), []);
    const targetDelta = useMemo(() => new Vector3(), []);
    const previousTarget = useMemo(() => new Vector3(...localPlayer.position), []);

    const camForward = useMemo(() => new Vector3(), []);
    const camRight = useMemo(() => new Vector3(), []);
    const moveDir = useMemo(() => new Vector3(), []);
    const up = useMemo(() => new Vector3(0, 1, 0), []);
    const tmpQuat = useMemo(() => new Quaternion(), []);
    const jumpQueued = useRef(false);
    const currentYaw = useRef(0); // need to be a ref to persist across useFrame callss

    const keys = useRef({
        w: false,
        a: false,
        s: false,
        d: false,
    });

    // detect which keys are preseed
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === "Space") {
                jumpQueued.current = true;
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
    }, []);

    useFrame((_state, delta) => {
        const rb = localRigidBodyRef.current;
        if (!rb) {
            return;
        }
        const currentPos = rb.translation(); // return rigid body's current world position as a vector
        const currentVel = rb.linvel();
        localPosition.set(currentPos.x, currentPos.y, currentPos.z);

        const inputX = (keys.current.d ? 1 : 0) - (keys.current.a ? 1 : 0);
        const inputZ = (keys.current.w ? 1 : 0) - (keys.current.s ? 1 : 0);

        moveDir.set(0, 0, 0);

        // calculate moveDir direction vector based on user input
        if (inputX !== 0 || inputZ !== 0) {
            camera.getWorldDirection(camForward);
            camForward.y = 0; // project onto xz plane
            camForward.normalize();

            camRight.copy(camForward).cross(up).normalize(); // if camForward is in the +z, camRight is in the -x

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
            const grounded = Math.abs(currentVel.y) < 0.05 && currentPos.y <= GROUND_Y + 0.15;
            if (grounded) {
                rb.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true);
            }
            jumpQueued.current = false;
        }

        // update camera position
        if (controlsRef.current) {
            // subtract new position from previous position --> this becomes the exact distance our camera also has to move
            targetDelta.subVectors(localPosition, previousTarget);
            camera.position.add(targetDelta);

            // center camera on avatar position
            controlsRef.current.target.copy(localPosition);
            controlsRef.current.update();

            previousTarget.copy(localPosition);
        }

        // handle avatar rotation
        if (moveDir.lengthSq() > 0.0001) {
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
                enableDamping
                dampingFactor={0.08}
                minDistance={0.3}
                maxDistance={100} // orig 25
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
