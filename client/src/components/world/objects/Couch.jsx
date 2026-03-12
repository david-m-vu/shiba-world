import { anchorOffset } from "../../../lib/util.js"

// Couches treat y position as the base position
const Couch = ({
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
    anchor = "center",
    ...groupProps
}) => {
    const anchorShift = anchorOffset(seatSize, anchor);
    const seatYOffset = seatSize[1] / 2;
    const backYOffset = seatSize[1] + (backSize[1] / 2);
    const resolvedBackOffset = backOffset ?? [
        0,
        backYOffset,
        (seatSize[2] / 2) - (backSize[2] / 2), // places the backrest towards the back of the couch
    ];
    return (
        <group
            position={[
                position[0] + anchorShift[0],
                position[1],
                position[2] + anchorShift[2],
            ]}
            rotation={rotation}
            scale={scale}
            {...groupProps}
        >
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

export default Couch;