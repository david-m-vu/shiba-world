/**
 * Shared 3D scene that is used with LandingPresentationLayer and MultiplayerLayer
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { MathUtils, Vector3 } from "three";
import { GUI } from "dat.gui";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import PreethamSky from "../components/PreethamSky.jsx";

import { LoungeChairSection, LoungeSection, CabanaSection, PlayAreaSection } from "../components/world/sections/index.js";
import {
    CoffeeTable,
    Couch,
    LoungeChair,
    PerimeterRailing,
    Planter,
    Slab,
    Grass,
} from "../components/world/objects/index.js";

const GGB_URL = new URL("../assets/golden_gate_bridge/scene.gltf", import.meta.url).href; // need URL to turn relative file path into a real, bundled URL

const DEFAULT_COLORS = {
    background: "#9fc4ff",
    fog: "#a97dbc",
    rooftopSurface: "#DBDAD6",
    rooftopSlab: "#c6e0c7",
    rooftopStairBulkhead: "#db9547",
    door: "#314563",
    railing: "#314563",
    couchSeat: "#b7927e",
    couchBack: "#b08674",
    coffeeTable: "#8b8278",
    skyline: "#c6e0c7",
    skylineEmissive: "#1a1f2a",
    ground: "#6d747d",
    plant: "#2c5a3a",
    loungeChairSectionGround: "#70a3ad"
};

const SKY_PARAMS = {
    skyElevation: 0.8,
    skyAzimuth: 1,
    skyTurbidity: 8,
    skyRayleigh: 3,
    skyMieCoefficient: 0.005,
    skyMieDirectionalG: 0.7,
    skyDistance: 450000,
};

const BASE_Y = -30;

const ROOFTOP_SIZE = [60, 30, 30];
const ROOFTOP_Y = 0;

const BULKHEAD_SIZE = [11, ROOFTOP_SIZE[1] + 8, 8]

const SKYLINE_BUILDINGS = [
    { position: [-140, 10, -120], size: [18, 20, 12] },
    { position: [-110, 16, -140], size: [14, 32, 10] },
    { position: [-70, 12, -150], size: [22, 24, 14] },
    { position: [-20, 18, -155], size: [16, 36, 12] },
    { position: [30, 14, -150], size: [20, 28, 14] },
    { position: [80, 10, -140], size: [18, 20, 12] },
    { position: [125, 12, -115], size: [22, 24, 16] },
    { position: [150, 10, -70], size: [18, 20, 12] },
    { position: [155, 14, -20], size: [20, 28, 14] },
    { position: [150, 12, 40], size: [18, 24, 12] },
    { position: [120, 16, 90], size: [14, 32, 10] },
    { position: [70, 12, 130], size: [20, 24, 14] },

    { position: [-90, 14, 130], size: [18, 28, 12] },
    { position: [-130, 12, 90], size: [20, 24, 14] },
    { position: [-150, 10, 40], size: [18, 20, 12] },
    { position: [-155, 14, -20], size: [20, 28, 14] },
];

const RAILING_DEPTH = 0.25;

const SharedEnvironment = ({ debug = false, sunset = false }) => {
    const [colors, setColors] = useState(DEFAULT_COLORS);
    const [skyParams, setSkyParams] = useState(SKY_PARAMS);
    const skyParamsRef = useRef({ ...SKY_PARAMS }); // need this because dat.gui needs a stable object reference to mutate, sine useState setState creates new objects
    const guiRef = useRef(null);

    const { scene: ggbModel } = useGLTF(GGB_URL);

    const showGui = debug || import.meta.env.DEV;

    const sunPosition = useMemo(() => {
        const phi = MathUtils.degToRad(90 - skyParams.skyElevation);
        const theta = MathUtils.degToRad(skyParams.skyAzimuth);
        const sun = new Vector3();
        sun.setFromSphericalCoords(100, phi, theta);
        return sun.toArray();
    }, [skyParams.skyElevation, skyParams.skyAzimuth]);

    useEffect(() => {
        // walk every child in the gltf scene graph, and for each mesh, make it so it casts shadows and receives shadows
        ggbModel.traverse((child) => { 
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [ggbModel]);

    useEffect(() => {
        if (!showGui) return;
        const safeDestroy = (gui) => {
            if (!gui) return;
            try {
                gui.destroy();
            } catch {
                // Ignore double-destroy errors from dat.gui in strict mode
            }
        };
        if (guiRef.current) {
            safeDestroy(guiRef.current);
            guiRef.current = null;
        }

        const gui = new GUI({ width: 300, name: "World Colors" });
        guiRef.current = gui;
        const params = { ...DEFAULT_COLORS, ...colors };

        const addFolderColor = (folder, key, label) => {
            // addColor renders a color picker
            folder.addColor(params, key).name(label).onChange((value) => {
                setColors((prev) => ({ ...prev, [key]: value }));
            });
        };

        const updateSkyParam = (key) => (value) => {
            skyParamsRef.current[key] = value;
            setSkyParams((prev) => ({ ...prev, [key]: value }));
        };

        const atmosphere = gui.addFolder("Atmosphere");
        atmosphere.open();
        addFolderColor(atmosphere, "background", "Background");
        addFolderColor(atmosphere, "fog", "Fog");
        const skyFolder = atmosphere.addFolder("Sky");
        skyFolder.add(skyParamsRef.current, "skyElevation", 0, 90)
            .name("Sky Elevation")
            .onChange(updateSkyParam("skyElevation"));
        skyFolder.add(skyParamsRef.current, "skyAzimuth", -180, 180)
            .name("Sky Azimuth")
            .onChange(updateSkyParam("skyAzimuth"));
        skyFolder.add(skyParamsRef.current, "skyTurbidity", 0, 20)
            .name("Sky Turbidity")
            .onChange(updateSkyParam("skyTurbidity"));
        skyFolder.add(skyParamsRef.current, "skyRayleigh", 0, 4)
            .name("Sky Rayleigh")
            .onChange(updateSkyParam("skyRayleigh"));
        skyFolder.add(skyParamsRef.current, "skyMieCoefficient", 0, 0.1)
            .name("Sky Mie Coefficient")
            .onChange(updateSkyParam("skyMieCoefficient"));
        skyFolder.add(skyParamsRef.current, "skyMieDirectionalG", 0, 1)
            .name("Sky Mie Direction G")
            .onChange(updateSkyParam("skyMieDirectionalG"));
        skyFolder.add(skyParamsRef.current, "skyDistance", 0, 500000)
            .name("Sky Distance")
            .onChange(updateSkyParam("skyDistance"));

        const rooftop = gui.addFolder("Rooftop");
        rooftop.open();
        addFolderColor(rooftop, "rooftopSurface", "Surface");
        addFolderColor(rooftop, "rooftopSlab", "Slab");
        addFolderColor(rooftop, "railing", "Railings");
        addFolderColor(rooftop, "rooftopStairBulkhead", "Stair Bulkhead");
        addFolderColor(rooftop, "loungeChairSectionGround", "Secondary Ground");
        addFolderColor(rooftop, "door", "Door");

        const furniture = gui.addFolder("Furniture");
        furniture.open();
        addFolderColor(furniture, "couchSeat", "Couch Seat");
        addFolderColor(furniture, "couchBack", "Couch Back");
        addFolderColor(furniture, "coffeeTable", "Coffee Table");

        const plants = gui.addFolder("Plants");
        plants.open();
        addFolderColor(plants, "plant", "Plant");

        const skyline = gui.addFolder("Skyline");
        skyline.open();
        addFolderColor(skyline, "skyline", "Buildings");
        addFolderColor(skyline, "skylineEmissive", "Emissive");
        addFolderColor(skyline, "ground", "Ground");

        return () => {
            safeDestroy(guiRef.current);
            guiRef.current = null;
        };
    }, [showGui]);

    return (
        <>
            <color attach="background" args={[colors.background]} />
            <fog attach="fog" args={[colors.fog, 2, 300]} /> 
            
            <ambientLight intensity={0.4}/>
            {/* <hemisphereLight intensity={0.3} groundColor="#2d2f2b" /> */}

            <ambientLight intensity={0.2} />

            <PreethamSky
                isDefaultSky={!sunset}
                distance={skyParams.skyDistance}
                elevation={skyParams.skyElevation}
                azimuth={skyParams.skyAzimuth}
                turbidity={skyParams.skyTurbidity}
                rayleigh={skyParams.skyRayleigh}
                mieCoefficient={skyParams.skyMieCoefficient}
                mieDirectionalG={skyParams.skyMieDirectionalG}
            />

            {/* rooftop blocks */}
            <group>
                {/* rooftop slab */}
                <Slab 
                    position={[0, BASE_Y, 0]}
                    size={ROOFTOP_SIZE}
                    color={colors.rooftopSlab}
                    roughness={0.8}
                    hasSeparateSurface
                    surfaceColor={colors.rooftopSurface}
                />
                
                {/* rooftop stair bulkhead */}
                <group position={[-(ROOFTOP_SIZE[0] / 2 - BULKHEAD_SIZE[0] / 2), BASE_Y, -(ROOFTOP_SIZE[2] / 2 + BULKHEAD_SIZE[2] / 2)]}>
                    <Slab 
                        size={BULKHEAD_SIZE}
                        color={colors.rooftopStairBulkhead}
                    />
                    {/* door */}
                    <Slab 
                        position={[BULKHEAD_SIZE[0] / 2 + 0.05, ROOFTOP_Y - BASE_Y, 0]}
                        size={[0.1, 3, 2]}
                        color={colors.door}
                    />
                </group>
                

                {/* bulkhead entrance */}
                <Slab 
                    position={[-(ROOFTOP_SIZE[0] / 2 - BULKHEAD_SIZE[0]), BASE_Y, -(ROOFTOP_SIZE[2] / 2)]}
                    size={[4, ROOFTOP_SIZE[1], 8]}
                    anchor="minXmaxZ"
                    hasSeparateSurface
                    surfaceColor={colors.rooftopSurface}
                />

                {/* entrance slab */}
                <Slab 
                    position={[ROOFTOP_SIZE[0] / 2, BASE_Y, -(ROOFTOP_SIZE[2] / 2)]}
                    size={[15, ROOFTOP_SIZE[1], 8]}
                    anchor="maxXmaxZ"
                    hasSeparateSurface
                    surfaceColor={colors.rooftopSurface}
                />
            </group>
            
            


            {/* front and back railings */}
            <PerimeterRailing 
                position={[0, ROOFTOP_Y, (ROOFTOP_SIZE[2] / 2) - (RAILING_DEPTH / 2)]} 
                args={[ROOFTOP_SIZE[0], 1.2, RAILING_DEPTH]} 
                color={colors.railing} 
            />
            <PerimeterRailing 
                position={[-(ROOFTOP_SIZE[0] / 2 - BULKHEAD_SIZE[0]), 0, -(ROOFTOP_SIZE[2] / 2 + BULKHEAD_SIZE[2])]} 
                args={[4, 2, RAILING_DEPTH]} 
                color={colors.railing} 
                anchor="minXminZ"
            />
            <PerimeterRailing 
                position={[(ROOFTOP_SIZE[0] / 2), 0, -(ROOFTOP_SIZE[2] / 2 + BULKHEAD_SIZE[2])]} 
                args={[15, 2, RAILING_DEPTH]} 
                color={colors.railing} 
                anchor="maxXminZ"
            />


            {/* left and right railings */}
            <PerimeterRailing 
                position={[(ROOFTOP_SIZE[0] / 2), ROOFTOP_Y, ROOFTOP_SIZE[2] / 2]} 
                args={[RAILING_DEPTH, 1.2, ROOFTOP_SIZE[2] + BULKHEAD_SIZE[2]]} 
                color={colors.railing} 
                anchor="maxXmaxZ"
            />
            <PerimeterRailing 
                position={[-((ROOFTOP_SIZE[0] / 2) - (RAILING_DEPTH / 2)), ROOFTOP_Y, 0]} 
                args={[RAILING_DEPTH, 1.2, ROOFTOP_SIZE[2]]} 
                color={colors.railing} 
            />

            {/* left side */}
            <LoungeSection
                position={[-(ROOFTOP_SIZE[0] / 2 - 4.5 - RAILING_DEPTH), ROOFTOP_Y + 0.01, 1]}
                seatColor={colors.couchSeat}
                backColor={colors.couchBack}
                coffeeTableColor={colors.coffeeTable}
                plantColor={colors.plant}
            />

            {/* middle */}
            <Slab 
                position={[-15, BASE_Y, -ROOFTOP_SIZE[2] / 2]}
                size={[30, ROOFTOP_SIZE[1] + 5, 8]}
                anchor="minXmaxZ"
                color={colors.rooftopSlab}
            />

            <Planter 
                position={[0, 0, -(ROOFTOP_SIZE[2] / 2 - 1.5)]}
                size={[30,1.5,3]}
                hasPlants
            />

            <LoungeChairSection 
                position={[0,0,3]}
                planterProps={{
                    plantColor: "#db5454"
                }}
                chairSpacingX={4}
                groundColor={colors.loungeChairSectionGround}
            />

            {/* right */}

            <PlayAreaSection 
                position={[ROOFTOP_SIZE[0] / 2 - 15/2, 0, -(ROOFTOP_SIZE[2] / 2 + BULKHEAD_SIZE[2] / 2 - 1.5)]}
                size={[15, 0.1, 11]}
            />

            <CabanaSection 
                position={[23,0,0]}
                size={[10,5,20]}
                rotation={[0,Math.PI,0]}
                tvFrameSize={[3.2, 1.7, 0.12]}
                tvScreenSize={[3.0, 1.6, 0.06]}
            />

            {/* skyline backdrop */}
            <group>
                {SKYLINE_BUILDINGS.map((building, index) => (
                    <mesh
                        key={`skyline-${index}`}
                        position={[
                            building.position[0],
                            BASE_Y + building.size[1] / 2,
                            building.position[2],
                        ]}
                        castShadow
                        receiveShadow
                    >
                        <boxGeometry args={building.size} />
                        <meshStandardMaterial
                            color={colors.skyline}
                            roughness={0.9}
                            emissive={colors.skylineEmissive}
                            emissiveIntensity={0.2}
                        />
                    </mesh>
                ))}
            </group>

            {/* distant ground for skyline */}
            <RigidBody type="fixed" colliders={false} position={[0, BASE_Y, 0]}>
                <CuboidCollider args={[250, 0.1, 250]} position={[0, -0.1, 0]} />
                <mesh rotation-x={-Math.PI / 2} receiveShadow>
                    <planeGeometry args={[500, 500]} />
                    <meshStandardMaterial color={colors.ground} roughness={1} />
                </mesh>
            </RigidBody>

            {/* GGB */}
            <primitive 
                object={ggbModel} 
                scale={50} 
                position={[0, BASE_Y + 10, 270]}
                rotation={[0, -Math.PI/8, 0]}
            />

            {debug ? (
                <>
                    <axesHelper args={[20]} position={[0, 1, 0]} />
                </>
            ) : null}

        </>
    );
};

export default SharedEnvironment;
