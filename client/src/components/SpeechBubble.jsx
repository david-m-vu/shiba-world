/**
 * This file renders a speech bubble relative to an Avatar (three.js)
 */

import { Suspense } from "react";
import { Billboard, RoundedBox, Text } from "@react-three/drei";

const SpeechBubble = ({ message = "", yOffset = 2.0 }) => {
    const safeMessage = String(message ?? "").trim();
    if (!safeMessage) {
        return null;
    }

    const bubbleWidth = 2.7;
    const estimatedLineCount = Math.max(1, Math.ceil(safeMessage.length / 28));
    const bubbleHeight = Math.max(0.15, Math.min(1.65, 0.11 + estimatedLineCount * 0.15));
    const tailRadius = 0.05;

    return (
        <Billboard position={[0, yOffset + bubbleHeight / 2, 0]} follow>
            <group>
                <RoundedBox
                    args={[bubbleWidth, bubbleHeight, 0.04]}
                    radius={0.035}
                    smoothness={12}
                    position={[0, 0, -0.01]} // push bubble background slightly behind the text to avoid z-fighting
                    renderOrder={19}
                >
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.95}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </RoundedBox>

                {/* bubble tail */}
                <mesh
                    position={[0, -(bubbleHeight / 2) - tailRadius * 0.45, -0.01]}
                    rotation={[0, 0, -Math.PI / 2]}
                    renderOrder={19}
                >
                    <circleGeometry args={[tailRadius, 3]} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.95}
                        depthWrite={false}
                        depthTest={false}
                        toneMapped={false}
                    />
                </mesh>

                <Suspense fallback={null}>
                    <Text
                        maxWidth={bubbleWidth - 0.22}
                        fontSize={0.14}
                        lineHeight={1.15}
                        overflowWrap="break-word"
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#111111"
                        material-depthWrite={false}
                        material-depthTest={false}
                        material-toneMapped={false}
                        renderOrder={20}
                    >
                        {safeMessage}
                    </Text>
                </Suspense>
            </group>
        </Billboard>
    );
};

export default SpeechBubble;
