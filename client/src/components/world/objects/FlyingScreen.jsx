import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

const FlyingScreen = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    screenSize = [20, 10, 0.2],
    screenInset = 0.1,
    frameColor = "#141922",
    screenColor = "black",
    backColor = "gray",
    supportHeight = 0.5,
    supportRadius = 0.12,
    supportColor = "#2b3444",
    rotorLift = 0,
    rotorBladeCount = 3,
    rotorBladeLength = 3,
    rotorBladeWidth = 0.26,
    rotorBladeThickness = 0.09,
    rotorColor = "#1f2835",
    rotorHubColor = "#475569",
    rotorSpinSpeed = 5,
    ...groupProps
}) => {
    const leftRotorRef = useRef(null);
    const rightRotorRef = useRef(null);

    const frameThickness = screenInset;
    const frameSize = [
        screenSize[0] + frameThickness * 2,
        screenSize[1] + frameThickness * 2,
        screenSize[2] + frameThickness,
    ];

    const screenTopY = frameSize[1] / 2;
    const supportXOffset = (frameSize[0] / 2) - frameThickness * 2;
    const rotorY = screenTopY + supportHeight + rotorLift;

    useFrame((_state, delta) => {
        const spinDelta = rotorSpinSpeed * delta;

        if (leftRotorRef.current) {
            leftRotorRef.current.rotation.y += spinDelta;
        }

        if (rightRotorRef.current) {
            rightRotorRef.current.rotation.y -= spinDelta;
        }
    });

    const rotorGeometries = Array.from({ length: rotorBladeCount }, (_, index) => (
        <group
            key={`blade-${index}`}
            rotation={[0, (index / rotorBladeCount) * Math.PI * 2, 0]}
        >
            <mesh
                // blade root sits at hub center, then extends outward along +X
                position={[rotorBladeLength / 2, 0, 0]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[rotorBladeLength, rotorBladeThickness, rotorBladeWidth]} />
                <meshStandardMaterial color={rotorColor} roughness={0.55} metalness={0.28} />
            </mesh>
        </group>
    ));

    return (
        <group
            position={position}
            rotation={rotation}
            scale={scale}
            {...groupProps}
        >
            {/* outer frame */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={frameSize} />
                <meshStandardMaterial color={frameColor} roughness={0.42} metalness={0.3} />
            </mesh>

            {/* front screen panel */}
            <mesh position={[0, 0, (frameSize[2] / 2) + 0.01]} castShadow receiveShadow>
                <boxGeometry args={[screenSize[0], screenSize[1], 0.08]} />
                <meshStandardMaterial
                    color={screenColor}
                    emissive={screenColor}
                    emissiveIntensity={0.08}
                    roughness={0.2}
                    metalness={0.08}
                />
            </mesh>

            {/* back panel */}
            <mesh position={[0, 0, -(frameSize[2] / 2) - 0.05]} castShadow receiveShadow>
                <boxGeometry args={[screenSize[0] * 0.96, screenSize[1] * 0.96, 0.1]} />
                <meshStandardMaterial color={backColor} roughness={0.55} metalness={0.18} />
            </mesh>

            {/* support poles */}
            <mesh
                position={[-supportXOffset, screenTopY + supportHeight / 2, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry args={[supportRadius, supportRadius, supportHeight, 16]} />
                <meshStandardMaterial color={supportColor} roughness={0.45} metalness={0.45} />
            </mesh>
            <mesh
                position={[supportXOffset, screenTopY + supportHeight / 2, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry args={[supportRadius, supportRadius, supportHeight, 16]} />
                <meshStandardMaterial color={supportColor} roughness={0.45} metalness={0.45} />
            </mesh>

            {/* left rotor */}
            <group ref={leftRotorRef} position={[-supportXOffset, rotorY, 0]}>
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.24, 0.24, 0.22, 18]} />
                    <meshStandardMaterial color={rotorHubColor} roughness={0.35} metalness={0.55} />
                </mesh>
                {rotorGeometries}
            </group>

            {/* right rotor */}
            <group ref={rightRotorRef} position={[supportXOffset, rotorY, 0]}>
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.24, 0.24, 0.22, 18]} />
                    <meshStandardMaterial color={rotorHubColor} roughness={0.35} metalness={0.55} />
                </mesh>
                {rotorGeometries}
            </group>
        </group>
    );
};

export default FlyingScreen;
