/**
 * This file receives player props and renders a single avatar (three.js)
 */

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";

import { AVATAR_POSITION_OFFSET } from "../constants/playerControls";
import NameTag from "./NameTag.jsx";

// public/ is served at the app root URL, so client/public/models/shiba/scene.gltf is available at /models/shiba/scene.gltf
const DOG_URL = "/models/shiba/scene.gltf";

const Avatar = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    hidden = false,
    playerName = "Anonymous",
    showNameTag = true,
    nameTagYOffset = 1.8,
    usePhysics = false,
    rigidBodyRef = null,
    rigidBodyProps = {},
    colliderProps = {},
    visualRef = null, // represents the group ref - used for hiding avatar if camera is too close
    groupRef = null, // used for non-physics avatars (for example remote interpolation)
}) => {
    const { scene } = useGLTF(DOG_URL); // load GLTF file, and also cache result so multiple avatars can reuse the same loaded data

    // clone so that each avatar has its own copy of the model (can be positioned indenpendently), and useMemo to avoid cloning on every render
    const model = useMemo(() => scene.clone(true), [scene]);
    
    useEffect(() => {
        // walk every child in the gltf scene graph, and for each mesh, make it so it casts shadows and receives shadows
        model.traverse((child) => { 
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [model]);

    // avatar mesh is a child of a RigidBody so it moves with the body automatically
    const avatarMesh = (
        <group ref={visualRef} visible={!hidden} scale={scale}>
            {/* primitive lets us render a raw three.js object directly - attach this three.js object into the React scene graph */}
            <primitive object={model} position={AVATAR_POSITION_OFFSET} /> 
            {showNameTag ? <NameTag name={playerName} yOffset={nameTagYOffset} /> : null}
            {/* <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial />
            </mesh> */}
        </group>
    );

    if (usePhysics) {
        return (
            // in our setup, RigidBody origin is used by movement/camera/ground checks, so keeping collider offset on the collider is usually better
            <RigidBody
                ref={rigidBodyRef}
                position={position}
                rotation={rotation}
                {...rigidBodyProps}
            >
                <CapsuleCollider {...colliderProps} />
                {avatarMesh}
            </RigidBody>
        );
    }

    // for remote avatars
    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            {avatarMesh}
        </group>
    );
};

useGLTF.preload(DOG_URL);

export default Avatar;
