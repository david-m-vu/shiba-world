/**
 * This file receives player props and renders a single avatar (three.js)
 */

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
const DOG_URL = new URL("../assets/shiba/scene.gltf", import.meta.url).href; // need URL to turn relative file path into a real, bundled URL

const Avatar = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    hidden = false,
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

    return (
        <group position={position} rotation={rotation} visible={!hidden}>
            {/* primitive lets us render a raw three.js object directly - attach this three.js object into the React scene graph */}
            {/* <primitive object={model} scale={scale} />  */}
            <mesh position={[0,0.5,0]}>
                <boxGeometry args={[1,1,1]}/>
                <meshNormalMaterial />
            </mesh>

        </group>
    );
};

useGLTF.preload(DOG_URL);

export default Avatar;
