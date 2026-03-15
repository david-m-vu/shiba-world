/**
 * This file handles rendering non-player objects in the room
 */

import { useGLTF } from "@react-three/drei";
import { useEffect } from "react";

import Planter from "../objects/Planter.jsx";
import Couch from "../objects/Couch.jsx";
import CoffeeTable from "../objects/CoffeeTable.jsx";
import { Grass } from "../objects/Grass.jsx";
import DiningSetSection from "../objects/DiningSet.jsx";

const ANIME_GIRL_URL = new URL("../../../assets/just_a_girl/scene.gltf", import.meta.url).href; // need URL to turn relative file path into a real, bundled URL

const LoungeSection = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    seatColor = "#b7927e",
    backColor = "#b08674",
    coffeeTableColor = "#8b8278",
    plantColor = "#2c5a3a",
    ...groupProps
}) => {
    
    const { scene: animeGirlModel } = useGLTF(ANIME_GIRL_URL);

    useEffect(() => {
        // walk every child in the gltf scene graph, and for each mesh, make it so it casts shadows and receives shadows
        animeGirlModel.traverse((child) => { 
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [animeGirlModel]);
    
    const mainPlanter = { size: [9, 1, 2], position: [0, 0, 0] };
    const sidePlanter = { size: [1, 1, 4] };
    const rightPlanter = { size: [2, 1, 2] };

    const mainHalfW = mainPlanter.size[0] / 2;
    const sideHalfW = sidePlanter.size[0] / 2;
    const rightHalfW = rightPlanter.size[0] / 2;

    const planterRowZ = 3;
    const leftSideX = -(mainHalfW - sideHalfW);
    const rightX = mainHalfW + rightHalfW;
    const rightSideX = mainHalfW + sideHalfW;

    const couchCluster = {
        position: [-0.5, 0, 2],
        longCouch: {
            position: [0, 0, 0],
            rotation: [0, Math.PI, 0],
        },
        shortCouch: {
            position: [-2, 0, 2],
            rotation: [0, -Math.PI / 2, 0],
        },
    };

    return (
        <group 
            position={position} 
            rotation={rotation} 
            scale={scale} 
            {...groupProps}
        >
            <Grass
                position={[mainHalfW, 0, -(mainPlanter.size[2] / 2 + 15)]}
                size={[mainPlanter.size[0] - 3, 0.1, 6]}
                anchor="maxXminZ"
            />
            <Grass
                position={[-mainHalfW, 0, -(mainPlanter.size[2] / 2)]}
                size={[3, 0.1, 15]}
                anchor="minXmaxZ"
            />

            <primitive object={animeGirlModel} position={[0, 0, -12]} scale={0.05}/>

            <Planter
                position={[mainHalfW, 0, -(mainPlanter.size[2] / 2 + 15 )]}
                size={[2,1,6]}
                anchor="minXminZ"
                hasPlants
                plantColor={"#d6c70e"}
            />

            <CoffeeTable size={[3, 0.5, 3]} position={[1, 0, -5]} color={"#BDC5CE"} />

            <Planter position={mainPlanter.position} size={mainPlanter.size} hasPlants plantColor={plantColor} />
            <Planter position={[leftSideX, 0, planterRowZ]} size={sidePlanter.size} hasPlants plantColor={plantColor} />
            <Planter position={[rightX, 0, 0]} size={rightPlanter.size} hasPlants plantColor={plantColor} />
            <Planter position={[rightSideX, 0, planterRowZ]} size={sidePlanter.size} hasPlants plantColor={plantColor} />

            <group position={couchCluster.position}>
                <Couch
                    position={couchCluster.longCouch.position}
                    seatSize={[6, 0.5, 2]}
                    rotation={couchCluster.longCouch.rotation}
                    seatColor={seatColor}
                    backColor={backColor}
                />
                <Couch
                    position={couchCluster.shortCouch.position}
                    seatSize={[6, 0.5, 2]}
                    rotation={couchCluster.shortCouch.rotation}
                    seatColor={seatColor}
                    backColor={backColor}
                />
            </group>

            <CoffeeTable 
                position={[1.25, 0, 5.5]} 
                color={coffeeTableColor} 
                rigidBodyProps={{
                    density: 6
                }}
            />

            <DiningSetSection
                position={[0, 0.01, 10.5]}
                chairDistance={2.25}
                tableProps={{
                    topRadius: 1.5,
                    topColor: "#f2f2f0",
                    baseColor: "#202125",
                }}
                chairProps={{
                    seatColor: "#17171a",
                    legColor: "#101013",
                }}
            />
        </group>
    );
};

export default LoungeSection