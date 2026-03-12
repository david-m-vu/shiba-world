import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";

const defaultRigidBodyProps = {
    type: "dynamic",
    colliders: false,
    density: 3,
    linearDamping: 20,
    angularDamping: 20,
}

// Lounge chair with a simple frame + fabric bed + angled backrest
const LoungeChair = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    anchor = "center",
    bedSize = [2.2, 0.12, 4.8], // [width (x), thickness (y), depth (z)]
    frameThickness = 0.12,
    legHeight = 0.55,
    backrestHeight = 1.1,
    backrestAngle = 0.45, // radians, leans toward +Z
    frameColor = "#3d4a55",
    fabricColor = "#6d7a84",
    ...groupProps
}) => {
    const frameWidth = bedSize[0] + frameThickness * 2;
    const frameDepth = bedSize[2] + frameThickness * 2;
    const anchorShift = anchorOffset([frameWidth, 0, frameDepth], anchor);

    const railY = legHeight - frameThickness / 2; // legs are slightly inside frame
    const railZOffset = frameDepth / 2 - frameThickness / 2; // offset from the center
    const railXOffset = frameWidth / 2 - frameThickness / 2; // offset from the center

    const bedY = legHeight + bedSize[1] / 2;
    const backrestZ = frameDepth / 2 - frameThickness;
    const backrestY = legHeight + bedSize[1] + backrestHeight / 2 - 0.03;

    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const basePosition = [
        position[0] + anchorShift[0],
        position[1],
        position[2] + anchorShift[2],
    ];

    return (
        <RigidBody 
            position={basePosition} 
            rotation={rotation}
            {...defaultRigidBodyProps}    
        >
            {/* frame/legs collider (prevents sinking) */}
            <CuboidCollider
                args={[
                    (frameWidth * scaleVec[0]) / 2,
                    (legHeight * scaleVec[1]) / 2,
                    (frameDepth * scaleVec[2]) / 2,
                ]}
                position={[
                    0,
                    (legHeight / 2) * scaleVec[1],
                    0,
                ]}
            />
            {/* bed collider */}
            <CuboidCollider
                args={[
                    (bedSize[0] * scaleVec[0]) / 2,
                    (bedSize[1] * scaleVec[1]) / 2,
                    (bedSize[2] * scaleVec[2]) / 2,
                ]}
                position={[
                    0,
                    bedY * scaleVec[1],
                    0,
                ]}
            />
            {/* backrest collider */}
            <CuboidCollider
                args={[
                    (bedSize[0] * scaleVec[0]) / 2,
                    (backrestHeight * scaleVec[1]) / 2,
                    (bedSize[1] * scaleVec[2]) / 2,
                ]}
                position={[
                    0,
                    backrestY * scaleVec[1],
                    backrestZ * scaleVec[2],
                ]}
                rotation={[backrestAngle, 0, 0]}
            />
            <group scale={scale} {...groupProps}>
            {/* legs */}
            {[
                [railXOffset, legHeight / 2, railZOffset],
                [-railXOffset, legHeight / 2, railZOffset],
                [railXOffset, legHeight / 2, -railZOffset],
                [-railXOffset, legHeight / 2, -railZOffset],
            ].map((pos, index) => (
                <mesh key={`leg-${index}`} position={pos} castShadow receiveShadow>
                    <boxGeometry args={[frameThickness, legHeight, frameThickness]} />
                    <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
                </mesh>
            ))}

            {/* side rails */}
            <mesh position={[railXOffset, railY, 0]} castShadow receiveShadow>
                <boxGeometry args={[frameThickness, frameThickness, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[-railXOffset, railY, 0]} castShadow receiveShadow>
                <boxGeometry args={[frameThickness, frameThickness, frameDepth]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>

            {/* front/back rails */}
            <mesh position={[0, railY, railZOffset]} castShadow receiveShadow>
                <boxGeometry args={[frameWidth, frameThickness, frameThickness]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[0, railY, -railZOffset]} castShadow receiveShadow>
                <boxGeometry args={[frameWidth, frameThickness, frameThickness]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>

            {/* fabric bed */}
            <mesh position={[0, bedY, 0]} castShadow receiveShadow>
                <boxGeometry args={bedSize} />
                <meshStandardMaterial color={fabricColor} roughness={0.8} metalness={0} />
            </mesh>

            {/* backrest */}
            <mesh
                position={[0, backrestY, backrestZ]}
                rotation={[backrestAngle, 0, 0]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[bedSize[0], backrestHeight, bedSize[1]]} />
                <meshStandardMaterial color={fabricColor} roughness={0.85} metalness={0} />
            </mesh>
            </group>
        </RigidBody>
    );
};

export default LoungeChair;
