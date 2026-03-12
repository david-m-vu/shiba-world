import { anchorOffset } from "../../../lib/util.js"

// Slabs treat y position as the base position
const Slab = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [1, 1, 1], 
    anchor = "center",
    color = "#c6e0c7",
    metalness = 0,
    roughness = 1,
    ...meshProps
}) => {
    const anchorShift = anchorOffset(size, anchor)
    
    return (
        <mesh 
            position={[
                position[0] + anchorShift[0],
                position[1] + (size[1] / 2),
                position[2] + anchorShift[2]
            ]} 
            scale={scale}
            rotation={rotation}
            receiveShadow 
            castShadow
            {...meshProps}
        >
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} metalness={metalness} roughtness={roughness} />
        </mesh>
    )
}

export default Slab;
