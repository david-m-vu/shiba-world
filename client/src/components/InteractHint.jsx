import { Suspense } from "react";
import { Billboard, RoundedBox, Text } from "@react-three/drei"

const InteractHint = ({
    position = [0, 0, 0],
    text = "",
}) => {
    const safeText = String(text ?? "").trim();

    if (!safeText) {
        return null;
    }

    return (
        <Billboard position={position} follow>
            <group>
                <RoundedBox
                    args={[3.9, 0.36, 0.04]}
                    radius={0.04}
                    smoothness={12}
                    position={[0, 0, -0.01]}
                    renderOrder={29}
                >
                    <meshBasicMaterial
                        color="#101118"
                        transparent
                        opacity={0.7}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </RoundedBox>

                <Suspense fallback={null}>
                    <Text
                        fontSize={0.15}
                        maxWidth={3.5}
                        anchorX="center"
                        anchorY="middle"
                        color="#f8fafc"
                        material-depthWrite={false}
                        material-depthTest={false}
                        material-toneMapped={false}
                        renderOrder={30}
                    >
                        {safeText}
                    </Text>
                </Suspense>
            </group>
        </Billboard>
    );
};

export default InteractHint
