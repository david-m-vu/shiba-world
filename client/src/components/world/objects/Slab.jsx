import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";


// Slabs treat y position as the base position
const Slab = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [1, 1, 1], 
    anchor = "center",
    color = "#c6e0c7",
    surfaceColor = "#ffffff",
    surfaceOffset = 0.01,
    metalness = 0,
    roughness = 1,
    hasSeparateSurface = false,
    ...meshProps
}) => {
    const anchorShift = anchorOffset(size, anchor);
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1] + (size[1] / 2),
        position[2] + anchorShift[2],
    ];
    // define the shape of the collider --> the size of the RigidBody
    const colliderHalf = [ 
        (size[0] * scaleVec[0]) / 2,
        (size[1] * scaleVec[1]) / 2,
        (size[2] * scaleVec[2]) / 2,
    ];
    
    return (
        <RigidBody
            type="fixed"
            colliders={false} // don't auto-generate colliders from the child meshes
            position={basePosition}
            rotation={rotation}
        >
            <CuboidCollider args={colliderHalf} />
            <group scale={scale} {...meshProps}>
                <mesh receiveShadow castShadow>
                    <boxGeometry args={size} />
                    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
                </mesh>
                {hasSeparateSurface ? (
                    <mesh rotation-x={-Math.PI / 2} position={[0, (size[1] / 2) + surfaceOffset, 0]} receiveShadow>
                        <planeGeometry args={[size[0], size[2]]} />
                        <meshStandardMaterial color={surfaceColor} roughness={0.75} metalness={0.05} />
                    </mesh>
                ) : null}
            </group>
        </RigidBody>
    )
}

export default Slab;
