import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";

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
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1],
        position[2] + anchorShift[2],
    ];

    return (
        <RigidBody type="fixed" colliders={false} position={basePosition} rotation={rotation}>
            {/* collider for the seat */}
            <CuboidCollider
                args={[
                    (seatSize[0] * scaleVec[0]) / 2,
                    (seatSize[1] * scaleVec[1]) / 2,
                    (seatSize[2] * scaleVec[2]) / 2,
                ]}
                position={[
                    0,
                    seatYOffset * scaleVec[1],
                    0,
                ]}
            />
            <CuboidCollider
                args={[
                    (backSize[0] * scaleVec[0]) / 2,
                    (backSize[1] * scaleVec[1]) / 2,
                    (backSize[2] * scaleVec[2]) / 2,
                ]}
                position={[
                    resolvedBackOffset[0] * scaleVec[0],
                    resolvedBackOffset[1] * scaleVec[1],
                    resolvedBackOffset[2] * scaleVec[2],
                ]}
            />
            <group scale={scale} {...groupProps}>
                <mesh castShadow receiveShadow position={[0, seatYOffset, 0]}>
                    <boxGeometry args={seatSize} />
                    <meshStandardMaterial color={seatColor} metalness={metalness} roughness={roughness} />
                </mesh>
                <mesh castShadow receiveShadow position={resolvedBackOffset}>
                    <boxGeometry args={backSize} />
                    <meshStandardMaterial color={backColor} metalness={metalness} roughness={roughness} />
                </mesh>
            </group>
        </RigidBody>
    )
}

export default Couch;
