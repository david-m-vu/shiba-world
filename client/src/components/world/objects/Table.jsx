import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import { anchorOffset } from "../../../lib/util.js";

// Round pedestal dining table. Position is treated as floor/base origin.
const Table = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    anchor = "center",
    topRadius = 2,
    topThickness = 0.12,
    topHeight = 1,
    topColor = "#f2f2f0",
    topRoughness = 0.34,
    topMetalness = 0.08,
    pedestalHeight = 0.9,
    pedestalRadiusTop = 0.1,
    pedestalRadiusBottom = 0.2,
    baseDiscRadius = 0.5,
    baseDiscHeight = 0.06,
    baseColor = "#1f1f22",
    rigidBodyProps = {},
    ...groupProps
}) => {
    const footprintSize = [topRadius * 2, 0, topRadius * 2];
    const anchorShift = anchorOffset(footprintSize, anchor);
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1],
        position[2] + anchorShift[2],
    ];

    const topColliderHalfHeight = (topThickness * scaleVec[1]) / 2;
    // Cylinder collider is circular; for non-uniform X/Z scale, use the larger radius
    // so players never clip into the visible tabletop.
    const topColliderRadius = topRadius * Math.max(scaleVec[0], scaleVec[2]);
    const topColliderPos = [
        0,
        (topHeight + topThickness / 2) * scaleVec[1],
        0,
    ];

    const pedestalColliderRadius = Math.max(pedestalRadiusBottom, baseDiscRadius);
    const pedestalColliderHeight = pedestalHeight + baseDiscHeight;
    const pedestalColliderHalf = [
        pedestalColliderRadius * scaleVec[0],
        (pedestalColliderHeight * scaleVec[1]) / 2,
        pedestalColliderRadius * scaleVec[2],
    ];
    const pedestalColliderPos = [
        0,
        (pedestalColliderHeight / 2) * scaleVec[1],
        0,
    ];

    return (
        <RigidBody
            type="fixed"
            colliders={false}
            position={basePosition}
            rotation={rotation}
            {...rigidBodyProps}
        >
            <CylinderCollider args={[topColliderHalfHeight, topColliderRadius]} position={topColliderPos} />
            <CuboidCollider args={pedestalColliderHalf} position={pedestalColliderPos} />
            <group scale={scale} {...groupProps}>
                <mesh
                    position={[0, topHeight + topThickness / 2, 0]}
                    castShadow
                    receiveShadow
                >
                    <cylinderGeometry args={[topRadius, topRadius, topThickness, 64]} />
                    <meshStandardMaterial
                        color={topColor}
                        roughness={topRoughness}
                        metalness={topMetalness}
                    />
                </mesh>

                <mesh
                    position={[0, baseDiscHeight + pedestalHeight / 2, 0]}
                    castShadow
                    receiveShadow
                >
                    <cylinderGeometry args={[pedestalRadiusTop, pedestalRadiusBottom, pedestalHeight, 42]} />
                    <meshStandardMaterial color={baseColor} roughness={0.6} metalness={0.15} />
                </mesh>

                <mesh position={[0, baseDiscHeight / 2, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[baseDiscRadius, baseDiscRadius, baseDiscHeight, 40]} />
                    <meshStandardMaterial color={baseColor} roughness={0.65} metalness={0.12} />
                </mesh>
            </group>
        </RigidBody>
    );
};

export default Table;
