/**
 * Landing-only 3D presentation layer (camera movement), rendered on top of SharedEnvironment.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

const CAMERA_FOCUS_POINT = new Vector3(0, 0, 0);

// note we technically don't have to have this code in a separate component - can just do it in LandingPresentationlayer
const LandingCameraRig = () => {
    const { camera } = useThree();
    const targetPositionRef = useRef(new Vector3());
    const lookAtTargetRef = useRef(new Vector3());
    const smoothLookAtRef = useRef(new Vector3());

    // cinamatic camera init
    useEffect(() => {
        camera.position.set(44, 16, 0); // orig 40, 16, 28
        smoothLookAtRef.current.copy(CAMERA_FOCUS_POINT);
        camera.lookAt(CAMERA_FOCUS_POINT);
    }, [camera]);

    useFrame((state, delta) => {
        const elapsed = state.clock.getElapsedTime();
        
        // angle = linear term (elapsed * 0.16) + bounded wobble (+- 0.45)
        // https://www.desmos.com/calculator/aafzai0vlb
        const orbitAngle = (elapsed * 0.16) + (Math.sin(elapsed * 0.08) * 0.45);
        const orbitRadius = 44 + (Math.sin(elapsed * 0.33) * 5) + (Math.cos(elapsed * 0.17) * 3); // 44 + breathing wobble
        const orbitHeight = 15 + (Math.sin(elapsed * 0.4) * 2.6) + (Math.cos(elapsed * 0.22) * 1.8); // 15 + breathing wobble

        targetPositionRef.current.set(
            Math.cos(orbitAngle) * orbitRadius,
            orbitHeight,
            Math.sin(orbitAngle) * orbitRadius * 0.72, // squash orbit on the z axis, turning circle into an ellipse
        );

        lookAtTargetRef.current.set(
            Math.sin(elapsed * 0.25) * 4,
            1.5 + Math.sin(elapsed * 0.32) * 0.9,
            Math.cos(elapsed * 0.21) * 2.2,
        );

        // lower fps --> larger delta --> smaller exp --> larger alpha to make up for lack of frames
        const positionAlpha = 1 - Math.exp(-1.8 * delta);
        const lookAlpha = 1 - Math.exp(-2.3 * delta);

        // smooth camera position and camera target
        camera.position.lerp(targetPositionRef.current, positionAlpha);
        smoothLookAtRef.current.lerp(lookAtTargetRef.current, lookAlpha);
        camera.lookAt(smoothLookAtRef.current);
    });

    return null;
};

const LandingPresentationLayer = () => {
    return (
        <>
            <LandingCameraRig />
        </>
    );
};

export default LandingPresentationLayer;
