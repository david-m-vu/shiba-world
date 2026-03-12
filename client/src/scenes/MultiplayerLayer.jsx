/**
 * This file is the 3D scene that gets rendered with SharedEnvironment once the user joins a room.
 * Responsible for rendering all the Avatars including the current player's, NameTags, SpeechBubbles...
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import Avatar from "../components/Avatar.jsx";

const LOCAL_MOVE_SPEED = 8;
const HIDE_DISTANCE = 0.6;
const TURN_SPEED = 8;

const localPlayer = {
    id: "local",
    position: [0, 0, 0],
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
    const localGroupRef = useRef(null);

    const localPosition = useMemo(() => new Vector3(...localPlayer.position), []);
    const targetDelta = useMemo(() => new Vector3(), []);
    const previousTarget = useMemo(() => new Vector3(...localPlayer.position), []);

    const camForward = useMemo(() => new Vector3(), []);
    const camRight = useMemo(() => new Vector3(), []);
    const moveDir = useMemo(() => new Vector3(), []);
    const up = useMemo(() => new Vector3(0, 1, 0), []);

    const keys = useRef({
        w: false,
        a: false,
        s: false,
        d: false,
    });

    // detect which keys are preseed
    useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key.toLowerCase();
            if (key in keys.current) {
                keys.current[key] = true;
            }
        };
        const handleKeyUp = (event) => {
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

    useFrame((_, delta) => {
        const inputX = (keys.current.d ? 1 : 0) - (keys.current.a ? 1 : 0);
        const inputZ = (keys.current.w ? 1 : 0) - (keys.current.s ? 1 : 0);

        moveDir.set(0, 0, 0);

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
                // units/s * s/frame = units/frame --> avatar moves a certain number of units per frame, and if they have lower fps, they make up for that by having a larger delta
                localPosition.x += moveDir.x * LOCAL_MOVE_SPEED * delta; 
                localPosition.z += moveDir.z * LOCAL_MOVE_SPEED * delta;
            }
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

        // handle avatar rotation and visibility
        if (localGroupRef.current) {
            localGroupRef.current.position.copy(localPosition);
            localGroupRef.current.visible = (camera.position.distanceTo(localPosition) > HIDE_DISTANCE);

            if (moveDir.lengthSq() > 0.0001) {
                const targetYaw = Math.atan2(moveDir.x, moveDir.z); // find out what angle we're looking at relative to the +z
                localGroupRef.current.rotation.y = lerpAngle(
                    localGroupRef.current.rotation.y,
                    targetYaw,
                    Math.min(1, TURN_SPEED * delta) // make sure alpha doesn't exceed 1
                );
            }
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

            <group ref={localGroupRef}>
                <Avatar
                    position={[0, 0, 0]}
                    rotation={localPlayer.rotation}
                />
            </group>

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
