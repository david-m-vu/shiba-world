import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const OCEAN_OPACITY = 0.97;

const OCEAN_VERTEX_SHADER = `
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const OCEAN_FRAGMENT_SHADER = `
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uHighlightColor;

    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
        float waveLargeA = sin((vWorldPos.x * 0.018) + (uTime * 0.26));
        float waveLargeB = cos((vWorldPos.z * 0.022) - (uTime * 0.21));
        float waveSmall = sin(((vWorldPos.x + vWorldPos.z) * 0.09) + (uTime * 0.9));
        float wave = (waveLargeA * 0.34) + (waveLargeB * 0.34) + (waveSmall * 0.32);

        float horizon = smoothstep(0.06, 0.98, vUv.y);
        vec3 base = mix(uDeepColor, uShallowColor, horizon * 0.82);

        float glintMask = smoothstep(0.38, 0.96, wave + (horizon * 0.35));
        vec3 color = mix(base, uHighlightColor, glintMask * 0.36);

        float streaks = sin((vUv.x * 170.0) + (uTime * 1.05)) * 0.5 + 0.5;
        float farBand = smoothstep(0.55, 0.98, vUv.y);
        color += uHighlightColor * streaks * farBand * 0.08;

        gl_FragColor = vec4(color, uOpacity);
    }
`;

const OceanBackdrop = ({
    position = [0, 0, 0],
    size = [1200, 1200],
    color = "#5f7f98", // #88a4ba
    highlightColor = "#83aac4",
    oceanSurfaceOffset = 0.02
}) => {
    const oceanMaterialRef = useRef(null);
    const oceanUniforms = useMemo(() => {
        const deep = new THREE.Color(color);
        const highlight = new THREE.Color(highlightColor);
        return {
            uTime: { value: 0 },
            uOpacity: { value: OCEAN_OPACITY },
            uDeepColor: { value: deep },
            uShallowColor: { value: deep.clone().lerp(highlight, 0.35) },
            uHighlightColor: { value: highlight },
        };
    }, [color, highlightColor]);

    useFrame(({ clock }) => {
        if (!oceanMaterialRef.current) return;
        oceanMaterialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    });

    return (
        <group position={position}>
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
                <planeGeometry args={size} />
                <shaderMaterial
                    ref={oceanMaterialRef}
                    uniforms={oceanUniforms}
                    vertexShader={OCEAN_VERTEX_SHADER}
                    fragmentShader={OCEAN_FRAGMENT_SHADER}
                    transparent
                    depthWrite={false}
                />
            </mesh>

            {/* for shine */}
            <mesh rotation-x={-Math.PI / 2} position={[0, oceanSurfaceOffset, 0]}>
                <planeGeometry args={size} />
                <meshStandardMaterial
                    color={highlightColor}
                    roughness={0.2}
                    metalness={0.35}
                    transparent
                    opacity={0.5}
                    emissive={highlightColor}
                    emissiveIntensity={0.05}
                />
            </mesh>
        </group>
    );
};

export default OceanBackdrop;