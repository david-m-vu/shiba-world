/**
 * This file handles rendering non-player objects in the room
 */

// Railings treat y position as the base position
export const PerimeterRailing = ({ position, args, color, metalness = 0, roughness = 1, ...meshProps }) => {
    const basePosition = [
        position[0],
        position[1] + (args?.[1] ?? 0) / 2,
        position[2],
    ];
    return (
        <mesh position={basePosition} castShadow receiveShadow {...meshProps}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
    )
}

// Couches treat y position as the base position
export const Couch = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    seatSize = [6, 1, 2],
    backSize = [6, 0.6, 0.7],
    seatColor = "#b7927e",
    backColor = "#b08674",
    roughness = 0.7,
    metalness = 0,
    backOffset = null,
    ...groupProps
}) => {
    const seatYOffset = seatSize[1] / 2;
    const backYOffset = seatSize[1] + (backSize[1] / 2);
    const resolvedBackOffset = backOffset ?? [
        0,
        backYOffset,
        (seatSize[2] / 2) - (backSize[2] / 2), // places the backrest towards the back of the couch
    ];
    return (
        <group position={position} rotation={rotation} scale={scale} {...groupProps}>
            <mesh castShadow receiveShadow position={[0, seatYOffset, 0]}>
                <boxGeometry args={seatSize} />
                <meshStandardMaterial color={seatColor} metalness={metalness} roughness={roughness} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                position={resolvedBackOffset}
            >
                <boxGeometry args={backSize} />
                <meshStandardMaterial color={backColor} metalness={metalness} roughness={roughness} />
            </mesh>
        </group>
    )
}

// Coffee tables treat y position as the base position
export const CoffeeTable = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [1.6, 0.3, 1.6],
    color = "#8b8278",
    roughness = 0.4,
    metalness = 0.1,
    ...meshProps
}) => {
    const basePosition = [
        position[0],
        position[1] + size[1] / 2,
        position[2],
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
