import Chair from "./Chair.jsx";
import Table from "./Table.jsx";

const DiningSetSection = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    chairCount = 4,
    chairDistance = 2.5,
    chairAngleOffset = Math.PI / 2,
    tableProps = {},
    chairProps = {},
    showCenterpiece = true,
    ...groupProps
}) => {
    // const topHeight = tableProps.topHeight ?? 0.76;
    // const topThickness = tableProps.topThickness ?? 0.12;
    // const centerpieceY = topHeight + topThickness + 0.08;
    const step = (Math.PI * 2) / chairCount;

    return (
        <group position={position} rotation={rotation} scale={scale} {...groupProps}>
            <Table {...tableProps} />

            {/* spawn chairs */}
            {Array.from({ length: chairCount }).map((_, index) => {
                const angle = chairAngleOffset + step * index;
                const x = Math.cos(angle) * chairDistance;
                const z = Math.sin(angle) * chairDistance;
                const lookAtCenterYaw = Math.atan2(-x, -z);

                return (
                    <Chair
                        key={`dining-chair-${index}`}
                        position={[x, 0, z]}
                        rotation={[0, lookAtCenterYaw, 0]}
                        {...chairProps}
                    />
                );
            })}

            {/* {showCenterpiece ? (
                <group position={[0, centerpieceY, 0]}>
                    <mesh castShadow receiveShadow>
                        <sphereGeometry args={[0.2, 20, 20]} />
                        <meshStandardMaterial color="#f3f4f6" roughness={0.45} metalness={0.06} />
                    </mesh>
                    <mesh position={[0, 0.2, 0]} castShadow>
                        <cylinderGeometry args={[0.02, 0.03, 0.4, 10]} />
                        <meshStandardMaterial color="#4e7654" roughness={0.9} metalness={0} />
                    </mesh>
                    <mesh position={[0.07, 0.23, 0.02]} castShadow>
                        <sphereGeometry args={[0.06, 10, 10]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0} />
                    </mesh>
                    <mesh position={[-0.06, 0.25, -0.02]} castShadow>
                        <sphereGeometry args={[0.05, 10, 10]} />
                        <meshStandardMaterial color="#e5e7eb" roughness={0.9} metalness={0} />
                    </mesh>
                    <mesh position={[0.02, 0.29, -0.04]} castShadow>
                        <sphereGeometry args={[0.05, 10, 10]} />
                        <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0} />
                    </mesh>
                </group>
            ) : null} */}
        </group>
    );
};

export default DiningSetSection;
