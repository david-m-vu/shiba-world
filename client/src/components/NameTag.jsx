/**
 * This file renders a nametag relative to an Avatar (three.js)
 */
import { Billboard, RoundedBox, Text } from "@react-three/drei";

const NameTag = ({ name = "Anonymous", yOffset = 1.45 }) => {
    const safeName = String(name ?? "").trim().slice(0, 32) || "Anonymous";
    const plateWidth = Math.max(0.5, Math.min(3, 0.2 + safeName.length * 0.1));

    return (
        <Billboard position={[0, yOffset, 0]} follow>
            <group>
                <mesh position={[0, 0, -0.01]} renderOrder={9}>
                    <RoundedBox
                        args={[plateWidth, 0.22, 0.01]}
                        radius={0.01}
                        smoothness={100}
                        position={[0, 0, -0.01]} // push bubble background slightly behind the text to avoid z-fighting
                        renderOrder={9}
                    >
                        <meshBasicMaterial
                            color="#000000"
                            transparent
                            opacity={0.42}
                            depthWrite={false} // don't block later objects by depth
                            depthTest={false} // ignores depth comparisons, so it renders even if there is a geometry in front of it
                            toneMapped={false} // skips renderer tone mapping so color stays exact
                        />
                    </RoundedBox>

                </mesh>

                <Text
                    fontSize={0.15}
                    maxWidth={2}
                    anchorX="center"
                    anchorY="middle"
                    color="#f8fafc"
                    material-depthWrite={false}
                    material-depthTest={false}
                    material-toneMapped={false}
                    renderOrder={10}
                >
                    {safeName}
                </Text>
            </group>
        </Billboard>
    );
};

export default NameTag
