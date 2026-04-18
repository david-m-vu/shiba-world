/**
 * This file receives player props and renders a single avatar (three.js)
 */

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";

import { AVATAR_POSITION_OFFSET } from "../constants/playerControls";
import {
    AVATAR_MODEL_URLS,
    DEFAULT_AVATAR_MODEL,
    toAvatarModelUrl,
} from "../constants/avatarModels.js";
import NameTag from "./NameTag.jsx";
import SpeechBubble from "./SpeechBubble.jsx";

const Avatar = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    hidden = false,
    avatarModel = DEFAULT_AVATAR_MODEL,
    playerName = "Anonymous",
    activeMessage = "",
    showNameTag = true,
    nameTagYOffset = 1.7,
    showSpeechBubble = true,
    speechBubbleYOffset = 2.0,
    usePhysics = false,
    rigidBodyRef = null,
    rigidBodyProps = {},
    colliderProps = {},
    visualRef = null, // represents the group ref - used for hiding avatar if camera is too close
    groupRef = null, // used for non-physics avatars (for example remote interpolation)
}) => {
    const modelUrl = toAvatarModelUrl(avatarModel);
    const { scene } = useGLTF(modelUrl); // load GLTF file, and also cache result so multiple avatars can reuse the same loaded data

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
            {showSpeechBubble ? <SpeechBubble message={activeMessage} yOffset={speechBubbleYOffset} /> : null}
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

// preloads avatar URLs at module load time, so when useGLTF(modelUrl) runs later, the model is already fetched/parsed
// leads to fewer loading times on switching or spawning avatars at the cost of higher upfront network/memory usage on models players may never use
Object.values(AVATAR_MODEL_URLS).forEach((avatarModelUrl) => {
    useGLTF.preload(avatarModelUrl);
});

export default Avatar;
