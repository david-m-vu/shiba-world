import { anchorOffset } from "../../../lib/util.js"

// Railings treat y position as the base position
const PerimeterRailing = ({
    position,
    args,
    color,
    metalness = 0,
    roughness = 1,
    anchor = "center",
    ...meshProps
}) => {
    const anchorShift = anchorOffset(args, anchor);
    const basePosition = [
        position[0] + anchorShift[0],
        position[1] + (args?.[1] ?? 0) / 2,
        position[2] + anchorShift[2],
    ];
    return (
        <mesh position={basePosition} castShadow receiveShadow {...meshProps}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        </mesh>
    )
}

export default PerimeterRailing