import { anchorOffset } from "../../../lib/util.js"

// Planters treat y position as the base position
const Planter = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [3, 0.8, 3], // total container size (including dirt)
    dirtColor = "#5a4a3d",
    containerColor = "#835D2C",
    hasPlants = false,
    plantColor = "#2c5a3a",
    wallThickness = 0.2,
    containerHeightOffset = 0.15, // room between the top of the dirt and the top of the walls
    anchor = "center",
    ...groupProps
}) => {
    const anchorShift = anchorOffset(size, anchor);
    const baseThickness = wallThickness;
    const wallHeight = size[1];
    const dirtSize = [
        Math.max(0.01, size[0] - wallThickness * 2),
        Math.max(0.01, size[1] - baseThickness - containerHeightOffset),
        Math.max(0.01, size[2] - wallThickness * 2),
    ];
    const dirtYOffset = baseThickness + dirtSize[1] / 2;
    const plantMargin = 0.2;
    const plantSize = [
        Math.max(0.1, dirtSize[0] - plantMargin * 2),
        Math.max(0.12, dirtSize[1] * 0.8),
        Math.max(0.1, dirtSize[2] - plantMargin * 2),
    ];
    const plantYOffset = baseThickness + dirtSize[1] + plantSize[1] / 2;

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
            {/* container base */}
            <mesh position={[0, baseThickness / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[size[0], baseThickness, size[2]]} />
                <meshStandardMaterial color={containerColor} roughness={0.8} />
            </mesh>

            {/* container walls (open top) */}
            {/* back wall */}
            <mesh position={[0, wallHeight / 2, (size[2] / 2) - (wallThickness / 2)]} castShadow receiveShadow>
                <boxGeometry args={[size[0], wallHeight, wallThickness]} />
                <meshStandardMaterial color={containerColor} roughness={0.8} />
            </mesh>
            {/* front wall */}
            <mesh position={[0, wallHeight / 2, -(size[2] / 2 - wallThickness / 2)]} castShadow receiveShadow>
                <boxGeometry args={[size[0], wallHeight, wallThickness]} />
                <meshStandardMaterial color={containerColor} roughness={0.8} />
            </mesh>
            {/* left wall */}
            <mesh position={[size[0] / 2 - wallThickness / 2, wallHeight / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[wallThickness, wallHeight, size[2] - wallThickness * 2]} />
                <meshStandardMaterial color={containerColor} roughness={0.8} />
            </mesh>
            {/* right wall */}
            <mesh position={[-(size[0] / 2 - wallThickness / 2), wallHeight / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[wallThickness, wallHeight, size[2] - wallThickness * 2]} />
                <meshStandardMaterial color={containerColor} roughness={0.8} />
            </mesh>

            {/* dirt */}
            <mesh position={[0, dirtYOffset, 0]} castShadow receiveShadow>
                <boxGeometry args={dirtSize} />
                <meshStandardMaterial color={dirtColor} roughness={0.9} />
            </mesh>

            {/* bush-like plant */}
            {hasPlants ? (
                <mesh position={[0, plantYOffset, 0]} castShadow receiveShadow>
                    <boxGeometry args={plantSize} />
                    <meshStandardMaterial color={plantColor} transparent opacity={0.9} />
                </mesh>
            ) : null}
        </group>
    )
}

export default Planter;