import LoungeChair from "../objects/LoungeChair.jsx";
import Planter from "../objects/Planter.jsx";
import Slab from "../objects/Slab.jsx"
;
const LoungeChairSection = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    chairsPerGroup = 3,
    chairSpacingX = 4, // center to center spacing
    groupGapX = 4,
    rowSpacingZ = 11, // center to center spacing
    chairProps = {},
    planterProps = {},
    planterDepth = 2,
    planterHeight = 1,
    planterMargin = 0.4,
    groundColor= "#95DAE4",
    ...groupProps
}) => {
    const groundPadding = 7;
    
    const bedSize = chairProps.bedSize ?? [2.2, 0.12, 4.8];
    const frameThickness = chairProps.frameThickness ?? 0.12;
    const chairWidth = bedSize[0] + frameThickness * 2;
    const groupSpanX = (chairsPerGroup - 1) * chairSpacingX + chairWidth;
    const planterSize = planterProps.size ?? [
        groupSpanX + planterMargin * 2,
        planterHeight,
        planterDepth,
    ];

    const groupOffsetX = groupSpanX / 2 + groupGapX / 2;
    const groupCenters = [-groupOffsetX, groupOffsetX]; // centers for each group along the same row
    const rowCenters = [-rowSpacingZ / 2, rowSpacingZ / 2]; // centers for the rows

    const backSlabZMargin = 2
    const backSlabZ = -(planterDepth + (chairProps.bedSize ?? 4.8) + (frameThickness * 2) + (planterSize[2] / 2) + backSlabZMargin)

    return (
        <group
            position={position}
            rotation={rotation}
            scale={scale}
            {...groupProps}
        >
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow>
                <planeGeometry args={[groupSpanX * 2 + groupGapX + groundPadding, 24]} />
                <meshStandardMaterial color={groundColor} roughness={0.75} metalness={0.05} />
            </mesh>

            {groupCenters.map((groupX, groupIndex) => ( // iterate across groups
                <group key={`group-${groupIndex}`} position={[groupX, 0, 0]}>
                    {/* planter behind both rows */}
                    <Planter
                        position={[0, 0, 0]}
                        size={planterSize}
                        hasPlants
                        {...planterProps}
                    />

                    {rowCenters.map((rowZ, rowIndex) => ( // iterate across rows
                        <group key={`row-${rowIndex}`} position={[0, 0, rowZ]}>
                            {Array.from({ length: chairsPerGroup }).map((_, i) => {
                                const x =
                                    (i - ((chairsPerGroup - 1) / 2)) * chairSpacingX;
                                const facing = Math.PI;
                                return (
                                    <LoungeChair
                                        key={`chair-${rowIndex}-${i}`}
                                        position={[x, 0, 0]}
                                        rotation={[0, facing, 0]}
                                        {...chairProps}
                                    />
                                );
                            })}
                        </group>
                    ))}
                </group>
            ))}
            

            {/* back slabs */}
            {groupCenters.map((groupX, groupIndex) => {
                const backSlabX = groupX + (groupIndex === 0 ? -1 : 1);
                
                return (
                    <Slab 
                        key={`slab-${groupIndex}`}
                        position={[backSlabX, 0, backSlabZ]}
                        size={[planterSize[0] + 2, planterSize[1], planterSize[2]]}
                        color="#8b8278"
                    />
                )
            })
            }   

        </group>
    );
};

export default LoungeChairSection;
