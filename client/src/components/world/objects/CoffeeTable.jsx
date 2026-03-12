import { anchorOffset } from "../../../lib/util.js"

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
    const basePosition = [
        position[0] + anchorShift[0],
        position[1] + size[1] / 2,
        position[2] + anchorShift[2],
    ];
    return (
        <mesh
            position={basePosition}
            rotation={rotation}
            scale={scale}
            castShadow
            receiveShadow
            {...meshProps}
        >
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
        </mesh>
    )
}

export default CoffeeTable;