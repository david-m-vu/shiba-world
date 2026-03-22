import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { anchorOffset } from "../../../lib/util.js";
import { useSyncedObjectState } from "../../../hooks/useSyncedObjectState.js";

const defaultRigidBodyProps = {
    type: "dynamic",
    colliders: false,
    density: 5,
    linearDamping: 20,
    angularDamping: 20,
}

// Dining chair with a low-profile seat, leaned backrest, and slender angled legs.
const Chair = ({
    objectId = "",
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    anchor = "center",
    seatWidth = 1.25,
    seatDepth = 1.25,
    seatThickness = 0.08,
    seatHeight = 0.45,
    seatColor = "#1a1a1c",
    backHeight = 0.8,
    backThickness = 0.08,
    backTilt = 0.18,
    legRadius = 0.03,
    legHeight = 0.43,
    legSplay = 0.09,
    baseColliderPadding = 0.02,
    legColor = "#111113",
    rigidBodyProps = defaultRigidBodyProps,
    ...groupProps
}) => {
    const syncedRigidBodyRef = useSyncedObjectState({ objectId });
    const footprintSize = [seatWidth, 0, seatDepth];
    const anchorShift = anchorOffset(footprintSize, anchor);
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1],
        position[2] + anchorShift[2],
    ];

    const seatY = seatHeight + seatThickness / 2;
    const backY = seatHeight + seatThickness + backHeight / 2 - 0.02;
    const backZ = -(seatDepth / 2) + backThickness / 2 - 0.02;

    const legX = seatWidth / 2 - 0.1;
    const legZ = seatDepth / 2 - 0.1;
    const legs = [
        { pos: [legX, legHeight / 2, legZ], rot: [legSplay, 0, -legSplay] },
        { pos: [-legX, legHeight / 2, legZ], rot: [legSplay, 0, legSplay] },
        { pos: [legX, legHeight / 2, -legZ], rot: [-legSplay, 0, -legSplay] },
        { pos: [-legX, legHeight / 2, -legZ], rot: [-legSplay, 0, legSplay] },
    ];
    const legBoundsX = legX + legRadius;
    const legBoundsZ = legZ + legRadius;
    
    const baseColliderHalfX = (Math.max(seatWidth / 2, legBoundsX) + baseColliderPadding) * scaleVec[0];
    const baseColliderHalfY = ((seatHeight + seatThickness) / 2) * scaleVec[1];
    const baseColliderHalfZ = (Math.max(seatDepth / 2, legBoundsZ) + baseColliderPadding) * scaleVec[2];
    const baseColliderY = ((seatHeight + seatThickness) / 2) * scaleVec[1];

    return (
        <RigidBody
            ref={syncedRigidBodyRef}
            position={basePosition}
            rotation={rotation}
            {...rigidBodyProps}
        >
            {/* Single base collider for legs + seat improves dynamic resting stability. */}
            <CuboidCollider
                args={[
                    baseColliderHalfX,
                    baseColliderHalfY,
                    baseColliderHalfZ,
                ]}
                position={[0, baseColliderY, 0]}
            />
            <CuboidCollider
                args={[
                    (seatWidth * scaleVec[0]) / 2,
                    (backHeight * scaleVec[1]) / 2,
                    (backThickness * scaleVec[2]) / 2,
                ]}
                position={[0, backY * scaleVec[1], backZ * scaleVec[2]]}
                rotation={[-backTilt, 0, 0]}
            />
            <group scale={scale} {...groupProps}>
                <mesh position={[0, seatY, 0]} castShadow receiveShadow>
                    <boxGeometry args={[seatWidth, seatThickness, seatDepth]} />
                    <meshStandardMaterial color={seatColor} roughness={0.72} metalness={0.02} />
                </mesh>

                <mesh
                    position={[0, backY, backZ]}
                    rotation={[-backTilt, 0, 0]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[seatWidth, backHeight, backThickness]} />
                    <meshStandardMaterial color={seatColor} roughness={0.74} metalness={0.02} />
                </mesh>


                {legs.map((leg, index) => (
                    <mesh
                        key={`chair-leg-${index}`}
                        position={leg.pos}
                        rotation={leg.rot}
                        castShadow
                        receiveShadow
                    >
                        <cylinderGeometry args={[legRadius, legRadius, legHeight, 12]} />
                        <meshStandardMaterial color={legColor} roughness={0.58} metalness={0.24} />
                    </mesh>
                ))}
            </group>
        </RigidBody>
    );
};

export default Chair;
