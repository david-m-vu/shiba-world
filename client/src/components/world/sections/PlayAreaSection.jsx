import { Grass, Soccer } from "../objects"

const soccerColors = [
    "cyan",
    "gold",
    "greenyellow",
    "indigo"
]

export const PlayAreaSection = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    size = [15, 0.1, 11], // [width, height, depth]
    ...groupProps
}) => {
    const soccerXZPositions = [
        [size[0] / 4, size[2] / 4],
        [-size[0] / 4, size[2] / 4],
        [size[0] / 4, -size[2] / 4],
        [-size[0] / 4, -size[2] / 4],
    ]
    return (
        <group 
        position={position}
        rotation={rotation} 
            scale={scale}
            {...groupProps}
        >
            <Grass 
                size={size}
            />
            <Soccer objectId="play-area-soccer-0" />

            {soccerXZPositions.map(([x, z], index) => 
                <Soccer 
                    key={`soccer-${index}`}
                    objectId={`play-area-soccer-${index + 1}`}
                    position={[x, 0, z]}
                    color={soccerColors[index]}
                />
            )}
        </group>
        
    )
}

export default PlayAreaSection
