import { anchorOffset } from "../../../lib/util.js";
import Couch from "../objects/Couch.jsx";
import LoungeChair from "../objects/LoungeChair.jsx";
import CoffeeTable from "../objects/CoffeeTable.jsx";

const CabanaSection = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    anchor = "center",
    size = [12, 4, 8], // [width, height, depth]
    postThickness = 0.2,
    beamThickness = 0.2,
    slatThickness = 0.12,
    slatGap = 0.35,
    frameColor = "#3b4a55",
    slatColor = "#444c57",
    tvFrameColor = "#1f2328",
    tvScreenColor = "#0b0d10",
    tvFrameSize = [2.2, 1.3, 0.12],
    tvScreenSize = [2.0, 1.1, 0.06],
    chairProps = {},
    couchProps = {},
    tableProps = {},
    coffeeTableColor = "#e8b681",
    ...groupProps
}) => {
    const [width, height, depth] = size;
    const anchorShift = anchorOffset([width, 0, depth], anchor);
    const halfW = width / 2;
    const halfD = depth / 2;

    const postHeight = height; // legs
    const railY = height - beamThickness / 2; // horizontal rails
    const innerW = width - postThickness * 2;
    const innerD = depth - postThickness * 2;
    const slatCount = Math.max(3, Math.floor(innerD / (slatThickness + slatGap)));
    const slatStartZ = -innerD / 2 + slatThickness;

    const chairOffsetX = width * 0.25;
    const chairOffsetZ = depth * 0.25;
    const couchOffsetX = width * 0.28;
    const couchOffsetZ = depth * 0.1;

    return (
        <group
            position={[
                position[0] + anchorShift[0],
                position[1],
                position[2] + anchorShift[2],
            ]}
            rotation={rotation}
            scale={scale}
            {...groupProps}
        >
            {/* posts */}
            {[
                [halfW - postThickness / 2, postHeight / 2, halfD - postThickness / 2], // back left
                [-halfW + postThickness / 2, postHeight / 2, halfD - postThickness / 2], // back right
                [halfW - postThickness / 2, postHeight / 2, -halfD + postThickness / 2], // front left
                [-halfW + postThickness / 2, postHeight / 2, -halfD + postThickness / 2], // front right
            ].map((pos, index) => (
                <mesh key={`post-${index}`} position={pos} castShadow receiveShadow>
                    <boxGeometry args={[postThickness, postHeight, postThickness]} />
                    <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
                </mesh>
            ))}

            {/* top horizontal beams */}
            <mesh position={[0, railY, halfD - postThickness / 2]} castShadow receiveShadow>
                <boxGeometry args={[width, beamThickness, postThickness]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[0, railY, -halfD + postThickness / 2]} castShadow receiveShadow>
                <boxGeometry args={[width, beamThickness, postThickness]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[halfW - postThickness / 2, railY, 0]} castShadow receiveShadow>
                <boxGeometry args={[postThickness, beamThickness, depth]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>
            <mesh position={[-halfW + postThickness / 2, railY, 0]} castShadow receiveShadow>
                <boxGeometry args={[postThickness, beamThickness, depth]} />
                <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.2} />
            </mesh>

            {/* pergola slats */}
            {Array.from({ length: slatCount }).map((_, i) => (
                <mesh
                    key={`slat-${i}`}
                    position={[0, height - slatThickness / 2, slatStartZ + i * (slatThickness + slatGap)]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[innerW, slatThickness, slatThickness]} />
                    <meshStandardMaterial color={slatColor} roughness={0.6} metalness={0.1} />
                </mesh>
            ))}

            {/* mix of lounge chairs and couches */}
            <LoungeChair position={[2, 0, chairOffsetZ]} rotation={[0, 0, 0]} {...chairProps} />
            <LoungeChair position={[0, 0, chairOffsetZ]} rotation={[0, 0, 0]} {...chairProps} />
            <LoungeChair position={[-2, 0, chairOffsetZ]} rotation={[0, 0, 0]} {...chairProps} />

            <Couch
                position={[-couchOffsetX, 0, -(couchOffsetZ + 2)]}
                rotation={[0, -Math.PI / 2, 0]}
                seatSize={[8, 0.5, 2]}
                backSize={[8, 0.5, 0.7]}
                {...couchProps}
            />
            <Couch
                position={[couchOffsetX, 0, -(couchOffsetZ + 2)]}
                rotation={[0, Math.PI / 2, 0]}
                seatSize={[8, 0.5, 2]}
                backSize={[8, 0.5, 0.7]}
                {...couchProps}
            />

            {/* table */}
            <CoffeeTable 
                position={[0, 0, -4]} 
                size={[1.6, 0.3, 5]} 
                {...tableProps} 
                color={coffeeTableColor}
            />

            {/* mounted TV (faces inward) */}
            <mesh position={[0, height - 0.9, -halfD + postThickness + 0.1]} castShadow receiveShadow>
                <boxGeometry args={tvFrameSize} />
                <meshStandardMaterial color={tvFrameColor} roughness={0.4} metalness={0.1} />
            </mesh>
            <mesh position={[0, height - 0.9, -halfD + postThickness + 0.17]} castShadow receiveShadow>
                <boxGeometry args={tvScreenSize} />
                <meshStandardMaterial color={tvScreenColor} roughness={0.3} metalness={0} />
            </mesh>
        </group>
    );
};

export default CabanaSection;
