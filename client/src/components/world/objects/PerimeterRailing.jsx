import { anchorOffset } from "../../../lib/util.js"
import { CuboidCollider, RigidBody } from "@react-three/rapier";

// Railings treat y position as the base position
const PerimeterRailing = ({
    position,
    args,
    color,
    metalness = 0,
    roughness = 0.5,
    glass = false,
    glassMode = "physical",
    opacity = 1,
    transmission = 0,
    ior = 1.45,
    thickness = 0.12,
    clearcoat = 0,
    clearcoatRoughness = 0.05,
    anchor = "center",
    rotation = [0, 0, 0],
    ...meshProps
}) => {
    const anchorShift = anchorOffset(args, anchor);
    const basePosition = [
        position[0] + anchorShift[0],
        position[1] + (args?.[1] ?? 0) / 2,
        position[2] + anchorShift[2],
    ];
    const colliderHalf = [
        (args?.[0] ?? 0) / 2,
        (args?.[1] ?? 0) / 2,
        (args?.[2] ?? 0) / 2,
    ];
    return (
        <RigidBody type="fixed" colliders={false} position={basePosition} rotation={rotation}>
            <CuboidCollider args={colliderHalf} />
            <mesh castShadow receiveShadow {...meshProps}>
                <boxGeometry args={args} />
                {glass && glassMode === "physical" ? (
                    <meshPhysicalMaterial
                        color={color}
                        metalness={metalness}
                        roughness={roughness}
                        transparent
                        opacity={opacity}
                        transmission={transmission} // how much light passes through physically
                        ior={ior} // index of refraction - glass is around 1.45
                        thickness={thickness} // virtual material thickness
                        clearcoat={clearcoat} // extra glossy top layer
                        clearcoatRoughness={clearcoatRoughness} // blur on clearocat reflection (0 sharp, higher = blurrier)
                    />
                ) : glass ? (
                    <meshStandardMaterial
                        color={color}
                        metalness={metalness}
                        roughness={roughness}
                        transparent
                        opacity={opacity}
                    />
                ) : (
                    <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
                )}
            </mesh>
        </RigidBody>
    )
}

export default PerimeterRailing
