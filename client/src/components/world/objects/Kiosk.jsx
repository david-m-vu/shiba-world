import { useTexture } from "@react-three/drei";
import youtubeLogoUrl from "../../../assets/brands/yt_icon_red_digital.png";

const Kiosk = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    baseSize = [1.5, 0.1, 1.5],
    pedestalSize = [0.3, 1, 0.3],
    headSize = [1.7, 1.1, 0.15],
    screenSize = [1.6, 1, 0.01],
    supportColor = "#101118",
    bodyColor = "#171922",
    frameColor = "#20232b",
    screenColor = "#53eafd",
    screenGlow = "#3e7cff",
    ...groupProps
}) => {
    const logoTexture = useTexture(youtubeLogoUrl)

    const headBottomY = (baseSize[1] / 2) + pedestalSize[1];

    return (
        <group position={position} rotation={rotation} scale={scale} {...groupProps}>
            {/* base plate */}
            <mesh castShadow receiveShadow position={[0, baseSize[1] / 2, 0]}>
                <boxGeometry args={baseSize} />
                <meshStandardMaterial color={supportColor} roughness={0.45} metalness={0.35} />
            </mesh>

            {/* pedestal */}
            <mesh castShadow receiveShadow position={[0, baseSize[1] + (pedestalSize[1] / 2), 0]}>
                <boxGeometry args={pedestalSize} />
                <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.28} />
            </mesh>

            {/* kiosk head */}
            <group position={[0, headBottomY, 0.12]} rotation={[-0.785398, 0, 0]}>
                {/* front frame */}
                <mesh castShadow receiveShadow>
                    <boxGeometry args={headSize} />
                    <meshStandardMaterial color={frameColor} roughness={0.38} metalness={0.46} />
                </mesh>

                {/* full touchscreen display */}
                <mesh position={[0, 0, (headSize[2] / 2) + 0.01]} castShadow receiveShadow>
                    <boxGeometry args={screenSize} />
                    <meshStandardMaterial
                        color={screenColor}
                        emissive={screenGlow}
                        emissiveIntensity={0.35}
                        roughness={0.15}
                        metalness={0.2}
                    />
                </mesh>

                <mesh position={[0, 0, (headSize[2] / 2) + 0.02]}>
                    <planeGeometry args={[0.7, 0.55]} />
                    <meshBasicMaterial
                        map={logoTexture}
                        transparent
                        alphaTest={0.1}
                        toneMapped={false}
                    />
                </mesh>

                {/* display glare strip */}
                {/* <mesh
                    position={[-(screenSize[0] * 0.22), 0, (headSize[2] / 2) + 0.078]}
                    rotation={[0, 0, 0.45]}
                >
                    <boxGeometry args={[0.22, screenSize[1] * 0.95, 0.01]} />
                    <meshStandardMaterial color="#9ec2ff" emissive="#6f9dff" emissiveIntensity={0.2} transparent opacity={0.18} />
                </mesh> */}
            </group>
        </group>
    );
};

export default Kiosk;
