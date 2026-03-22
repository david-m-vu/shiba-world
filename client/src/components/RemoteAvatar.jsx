import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { useFrame } from "@react-three/fiber"

import Avatar from "./Avatar.jsx";

import { getShortestAngleDelta } from "../lib/util.js";

const REMOTE_POSITION_DAMPING = 12;
const REMOTE_ROTATION_DAMPING = 18;
const REMOTE_SNAP_DISTANCE = 8;

// time-based lerp: larger delta --> larger alpha to make up for lack of fps
const getSmoothingAlpha = (dampingStrength, delta) => {
    return 1 - Math.exp(-dampingStrength * delta);
};

const toSafeYaw = (rotation = [0, 0, 0]) => {
    const parsed = Number(rotation?.[1]);
    return Number.isFinite(parsed) ? parsed : 0;
};

const RemoteAvatar = ({ player }) => {
    const rootRef = useRef(null); // points to Avatar's top-level group. used to imperatively apply smoothed transforms each frame onto Avatar
    const targetPositionRef = useRef(new Vector3(...player.position));
    const currentPositionRef = useRef(new Vector3(...player.position));
    const targetYawRef = useRef(toSafeYaw(player.rotation));
    const currentYawRef = useRef(toSafeYaw(player.rotation));

    // handle target position changes
    useEffect(() => {
        const [x, y, z] = player.position;
        targetPositionRef.current.set(x, y, z);

        // if the target position is really far (> REMOTE_SNAP_DISTANCE), just tp there instead of interpolating
        if (currentPositionRef.current.distanceTo(targetPositionRef.current) > REMOTE_SNAP_DISTANCE) {
            currentPositionRef.current.copy(targetPositionRef.current);

            if (rootRef.current) {
                rootRef.current.position.copy(currentPositionRef.current);
            }
        }
    }, [player.position]);

    // handle target rotation changes
    useEffect(() => {
        const nextYaw = toSafeYaw(player.rotation);
        targetYawRef.current = nextYaw;

        // snap guard for large yaw jumps, set currentYawRef immediately
        if (Math.abs(getShortestAngleDelta(currentYawRef.current, nextYaw)) > Math.PI * 0.75) {
            currentYawRef.current = nextYaw;

            if (rootRef.current) {
                rootRef.current.rotation.set(0, currentYawRef.current, 0);
            }
        }
    }, [player.rotation]);

    useFrame((_state, delta) => {
        if (!rootRef.current) {
            return;
        }

        const positionAlpha = getSmoothingAlpha(REMOTE_POSITION_DAMPING, delta);
        const yawAlpha = getSmoothingAlpha(REMOTE_ROTATION_DAMPING, delta);

        currentPositionRef.current.lerp(targetPositionRef.current, positionAlpha);
        currentYawRef.current += getShortestAngleDelta(currentYawRef.current, targetYawRef.current) * yawAlpha;

        rootRef.current.position.copy(currentPositionRef.current);
        rootRef.current.rotation.set(0, currentYawRef.current, 0);
    });

    return (
        <Avatar
            position={player.position}
            rotation={[0, toSafeYaw(player.rotation), 0]}
            groupRef={rootRef}
        />
    );
};

export default RemoteAvatar