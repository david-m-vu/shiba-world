import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { useGameStore } from "../store/useGameStore.js";
import { toSafeVector3 } from "../lib/util.js";

const OBJECT_SYNC_INTERVAL_MS = 66;
const OBJECT_SYNC_POSITION_EPSILON = 0.02;
const OBJECT_SYNC_QUATERNION_EPSILON = 0.0005;
const OBJECT_SYNC_VELOCITY_EPSILON = 0.05;
const REMOTE_APPLY_SEND_SUPPRESSION_MS = 120; // one-shot cooldown triggered only right after applying remote state

const getVectorDeltaMagnitude = (a = [0, 0, 0], b = [0, 0, 0]) => {
    return Math.hypot(
        (a[0] ?? 0) - (b[0] ?? 0),
        (a[1] ?? 0) - (b[1] ?? 0),
        (a[2] ?? 0) - (b[2] ?? 0)
    );
};

// Dot-product based similarity for quaternion change detection.
const getQuaternionDelta = (a = [0, 0, 0, 1], b = [0, 0, 0, 1]) => {
    // remember that quaternions are always normalized
    const dot = Math.abs(
        (a[0] ?? 0) * (b[0] ?? 0)
        + (a[1] ?? 0) * (b[1] ?? 0)
        + (a[2] ?? 0) * (b[2] ?? 0)
        + (a[3] ?? 1) * (b[3] ?? 1)
    );
    // dot = 1 means same rotation, smaller dot means more defferent, so 1 - dot = difference score, where 0 means no rotation difference
    return 1 - Math.min(1, dot);
};

// a zero quaternion is invalid for rotation, and this is to avoid dividing by zero
const toSafeQuaternion = (value, fallback = [0, 0, 0, 1]) => {
    if (!Array.isArray(value) || value.length !== 4) {
        return [...fallback];
    }

    const normalized = value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
    const length = Math.hypot(normalized[0], normalized[1], normalized[2], normalized[3]);

    if (length < 0.000001) {
        return [...fallback];
    }

    return normalized.map((entry) => entry / length);
};

const nowMs = () => {
    // performance.now() is a high-resolution timer in ms from the page's time origin
    // it's more previse than Date.now() and monotonically increasing (won't jump backward if the system clock is adjusted)
    if (typeof performance !== "undefined" && Number.isFinite(performance.now())) {
        return performance.now();
    }
    return Date.now();
};

// used to sync a single object
export const useSyncedObjectState = ({ objectId = "" } = {}) => {
    const rigidBodyRef = useRef(null);
    const lastSentStateRef = useRef(null);
    const suppressSendsUntilMsRef = useRef(0);

    const safeObjectId = String(objectId ?? "").trim();
    const sendObjectUpdate = useGameStore((state) => state.sendObjectUpdate);
    const remoteObjectState = useGameStore((state) => {
        if (!safeObjectId) {
            return null;
        }
        return state.objectsById[safeObjectId] ?? null;
    });

    // update rigid body properties when remoteObjectState gets updated in the global store
    useEffect(() => {
        if (!safeObjectId || !remoteObjectState) {
            return;
        }

        const rb = rigidBodyRef.current;
        if (!rb) {
            return;
        }

        // set the attributes of the rigid body based currently on the object stored in the global state, only if it exists
        const position = toSafeVector3(remoteObjectState.position, [0, 0, 0]);
        const quaternion = toSafeQuaternion(remoteObjectState.quaternion, [0, 0, 0, 1]);
        const linvel = toSafeVector3(remoteObjectState.linvel, [0, 0, 0]);
        const angvel = toSafeVector3(remoteObjectState.angvel, [0, 0, 0]);

        // REMOTE_APPLY_SEND_SUPPRESSION_MS creates a short cooldown window after remote apply so local sending is temporarily paused
        // this is because: when you receive object:state, you set the rigid body to that remote transform/velocities. Without suppression,
        // next frame you might immediately resend that same state back via sendObjectUpdate. In short, it avoids echoing the same state back to server
        // note we can set the rigid body properties here unconditionally because sendObjectUpdate isn't called here
        suppressSendsUntilMsRef.current = nowMs() + REMOTE_APPLY_SEND_SUPPRESSION_MS;
        rb.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
        rb.setRotation({ x: quaternion[0], y: quaternion[1], z: quaternion[2], w: quaternion[3] }, true);
        rb.setLinvel({ x: linvel[0], y: linvel[1], z: linvel[2] }, true);
        rb.setAngvel({ x: angvel[0], y: angvel[1], z: angvel[2] }, true);

        // lastSentState always represents either the initial rigid body state, or the state received after a object:state, or the state getting sent to the server
        // here it gets updated due to receiving an object:state

        // since JS is single-threaded, this always gets executed after setting the properties of the rb atomically
        // this means we don't have to worry about useFrame running mid-function, and seeing that rb has changed before we set lastSentState
        lastSentStateRef.current = {
            sentAtMs: nowMs(),
            position,
            quaternion,
            linvel,
            angvel,
        };
    }, [remoteObjectState, safeObjectId]);

    useFrame(() => {
        if (!safeObjectId) {
            return;
        }

        const rb = rigidBodyRef.current;
        if (!rb) {
            return;
        }

        const currentNowMs = nowMs();
        // if there is still cooldown, don't send an update to the server
        if (currentNowMs < suppressSendsUntilMsRef.current) {
            return;
        }

        const rawPosition = rb.translation();
        const rawQuaternion = rb.rotation();
        const rawLinvel = rb.linvel();
        const rawAngvel = rb.angvel();

        // get next state from local rigid body properties
        const nextState = {
            position: [rawPosition.x, rawPosition.y, rawPosition.z],
            quaternion: [rawQuaternion.x, rawQuaternion.y, rawQuaternion.z, rawQuaternion.w],
            linvel: [rawLinvel.x, rawLinvel.y, rawLinvel.z],
            angvel: [rawAngvel.x, rawAngvel.y, rawAngvel.z],
        };
        const previousState = lastSentStateRef.current;

        // lastSentState always represents either the initial rigid body state, or the state received after a object:state, or the state getting sent to the server
        // here it gets initialized, so we return since there's no way it moved from its initial position under this condition
        if (!previousState) {
            lastSentStateRef.current = {
                sentAtMs: currentNowMs,
                ...nextState,
            };
            return;
        }

        // if we already sent a update recently, return
        if (currentNowMs - previousState.sentAtMs < OBJECT_SYNC_INTERVAL_MS) {
            return;
        }

        const didMove = getVectorDeltaMagnitude(previousState.position, nextState.position) > OBJECT_SYNC_POSITION_EPSILON;
        const didRotate = getQuaternionDelta(previousState.quaternion, nextState.quaternion) > OBJECT_SYNC_QUATERNION_EPSILON;
        const didLinearVelocityChange = getVectorDeltaMagnitude(previousState.linvel, nextState.linvel) > OBJECT_SYNC_VELOCITY_EPSILON;
        const didAngularVelocityChange = getVectorDeltaMagnitude(previousState.angvel, nextState.angvel) > OBJECT_SYNC_VELOCITY_EPSILON;

        // if it did any one of these, than we can send an update
        if (!didMove && !didRotate && !didLinearVelocityChange && !didAngularVelocityChange) {
            return;
        }

        sendObjectUpdate({
            objectId: safeObjectId,
            position: nextState.position,
            quaternion: nextState.quaternion,
            linvel: nextState.linvel,
            angvel: nextState.angvel,
        });

        lastSentStateRef.current = {
            sentAtMs: currentNowMs,
            ...nextState,
        };
    });

    return rigidBodyRef;
};
