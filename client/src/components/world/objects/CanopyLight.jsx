import { useEffect, useRef } from "react";

const CanopyLight = ({ 
    position = [0, 0, 0] ,
    lightColor = "#fff1d1",
    castShadow = true
}) => {
    const groupRef = useRef(null);
    const spotlightRef = useRef(null);

    useEffect(() => {
        if (!groupRef.current || !spotlightRef.current) return;

        // adding spotLight.target as a child of groupRef makes the target use the group's local transform,
        // so [0, -6, 0] means "always 6 units below relative to this fixture"
        groupRef.current.add(spotlightRef.current.target);
        spotlightRef.current.target.position.set(0, -6, 0);
        spotlightRef.current.target.updateMatrixWorld(); // make sure to refresh light target's world transform
    }, []);

    return (
        <group ref={groupRef} position={position}>
            {/* lightbulb holder */}
            <mesh position={[0, -0.05, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.18, 0.12, 20]} />
                <meshStandardMaterial color="#222830" metalness={0.7} roughness={0.45} />
            </mesh>
            {/* lightbulb */}
            <mesh position={[0, -0.16, 0]} castShadow>
                <cylinderGeometry args={[0.11, 0.14, 0.08, 20]} />
                <meshStandardMaterial
                    color="#fff1c2"
                    emissive="#ffe6a8"
                    emissiveIntensity={1.6}
                    roughness={0.3}
                />
            </mesh>
            <spotLight
                ref={spotlightRef}
                castShadow={castShadow}
                position={[0, -0.1, 0]}
                color={lightColor}
                intensity={18}
                angle={0.8}
                penumbra={0.55}
                distance={18}
                decay={2}
                shadow-mapSize-width={512}
                shadow-mapSize-height={512}
                shadow-bias={-0.0001}
            />
        </group>
    );
};

export default CanopyLight