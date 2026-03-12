import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace } from "three";
import { anchorOffset } from "../../../lib/util.js"

export const Grass = ({
    position = [0, 0, 0],
    size = [10, 0.1, 10],
    color = "#7fa870",
    roughness = 1,
    metalness = 0,
    anchor = "center",
    ...meshProps
}) => {
    const anchorShift = anchorOffset(size, anchor);

    return (
        <mesh
            position={[position[0] + anchorShift[0], position[1], position[2] + anchorShift[2]]}
            castShadow
            receiveShadow
            {...meshProps}
        >
            <boxGeometry args={size} />
            <meshStandardMaterial
                color={color}
                roughness={roughness}
                metalness={metalness}
            />
        </mesh>
    );
}

export const GrassWithTexture = ({
    position = [0, 0, 0],
    size = [10, 10], // [x, z] or [x, y, z]
    color = "#7fa870",
    roughness = 1,
    metalness = 0,
    anchor = "center",
    tile = 6,
    displacementScale = 0.12,
    segments = 128,
    ...meshProps
}) => {
    const sizeXZ = size.length === 2 ? size : [size[0], size[2]];
    const anchorShift = anchorOffset([sizeXZ[0], 0, sizeXZ[1]], anchor);

    const textures = useTexture({
        map: new URL("../assets/textures/grass/brown_mud_leaves_01_diff_1k.jpg", import.meta.url).href,
        displacementMap: new URL("../assets/textures/grass/brown_mud_leaves_01_disp_1k.png", import.meta.url).href,
    });

    if (textures.map) {
        textures.map.colorSpace = SRGBColorSpace;
        textures.map.wrapS = RepeatWrapping; // let texture tile instead of stretching once
        textures.map.wrapT = RepeatWrapping;
        textures.map.repeat.set(tile, tile); // set how many times the texture repeats across the plane
    }
    if (textures.displacementMap) {
        textures.displacementMap.wrapS = RepeatWrapping;
        textures.displacementMap.wrapT = RepeatWrapping;
        textures.displacementMap.repeat.set(tile, tile);
    }

    return (
        <mesh
            rotation-x={-Math.PI / 2}
            position={[position[0] + anchorShift[0], position[1], position[2] + anchorShift[2]]}
            castShadow
            receiveShadow
            {...meshProps}
        >
            <planeGeometry args={[sizeXZ[0], sizeXZ[1], segments, segments]} />
            <meshStandardMaterial
                color={color}
                roughness={roughness}
                metalness={metalness}
                map={textures.map}
                displacementMap={textures.displacementMap}
                displacementScale={displacementScale}
                displacementBias={-0.005}
            />
        </mesh>
    );
};
