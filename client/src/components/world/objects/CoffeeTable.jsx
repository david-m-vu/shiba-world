import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";

const defaultRigidBodyProps = {
    type: "dynamic",
    colliders: false,
    density: 5,
    linearDamping: 20,
    angularDamping: 20,
}

// Coffee tables treat y position as the base position
const CoffeeTable = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [2, 0.3, 2],
    color = "#8b8278",
    roughness = 0.4,
    metalness = 0.1,
    anchor = "center",
    rigidBodyProps = {},
    ...meshProps
}) => {
    const anchorShift = anchorOffset(size, anchor);
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1] + size[1] / 2,
        position[2] + anchorShift[2],
    ];
    const colliderHalf = [
        (size[0] * scaleVec[0]) / 2,
        (size[1] * scaleVec[1]) / 2,
        (size[2] * scaleVec[2]) / 2,
    ];
    return (
        <RigidBody
            position={basePosition}
            rotation={rotation}
            density={5}            // heavier
            linearDamping={20}   // slows sliding
            angularDamping={20}  // slows spinning
            {...rigidBodyProps}
        >
            <CuboidCollider 
                args={colliderHalf} 
                friction={1}      // grippier (default is ~0.5)
            />
            <mesh scale={scale} castShadow receiveShadow {...meshProps}>
                <boxGeometry args={size} />
                <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
            </mesh>
        </RigidBody>
    )
}

export default CoffeeTable;
