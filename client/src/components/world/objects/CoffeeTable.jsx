import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";


// Coffee tables treat y position as the base position
const CoffeeTable = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [1.6, 0.3, 1.6],
    color = "#8b8278",
    roughness = 0.4,
    metalness = 0.1,
    anchor = "center",
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
            type="fixed"
            colliders={false}
            position={basePosition}
            rotation={rotation}
        >
            <CuboidCollider args={colliderHalf} />
            <mesh scale={scale} castShadow receiveShadow {...meshProps}>
                <boxGeometry args={size} />
                <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
            </mesh>
        </RigidBody>
    )
}

export default CoffeeTable;
