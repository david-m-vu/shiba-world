/**
 * Shared 3D scene that is used with LandingPresentationLayer and MultiplayerLayer
 */

import { useEffect, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { GUI } from "dat.gui";
import { CuboidCollider, RigidBody } from "@react-three/rapier";

import PreethamSky from "../components/PreethamSky.jsx";
import OceanBackdrop from "../components/OceanBackdrop.jsx";
import { LoungeChairSection, LoungeSection, CabanaSection, PlayAreaSection, DiningSetSection } from "../components/world/sections/index.js";
import {
    CoffeeTable,
    Couch,
    LoungeChair,
    PerimeterRailing,
    Planter,
    Slab,
    Grass,
    CanopyLight
} from "../components/world/objects/index.js";

import { createDeterministicRandom, randomRange } from "../lib/util.js";

const GGB_URL = new URL("../assets/golden_gate_bridge/scene.gltf", import.meta.url).href; // need URL to turn relative file path into a real, bundled URL

const DEFAULT_COLORS = {
    background: "#9fc4ff",
    fog: "#b27389",
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
    loungeChairSectionGround: "#70a3ad",
    frame: "#db9547",
    overhangSlab: "#314563",
    ocean: "#60899F", // orig #5f7f98
    oceanHighlight: "#83aac4",
    sunsetLight: "#fb7739",
    canopyLight: "#fff1d1" // #efb92e for more orange
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

const MIDDLE_EXTENSION_POSITION = [-15, BASE_Y, -(ROOFTOP_SIZE[2] / 2)];
const MIDDLE_EXTENSION_SIZE = [30, ROOFTOP_SIZE[1] + 6, 8];
const MIDDLE_EXTENSION_TOP_Y = MIDDLE_EXTENSION_POSITION[1] + MIDDLE_EXTENSION_SIZE[1];

const CANTILEVER_OVERHANG_SIZE = [30, 0.2, 10];
const CANTILEVER_OVERHANG_POSITION = [
    MIDDLE_EXTENSION_POSITION[0],
    MIDDLE_EXTENSION_TOP_Y - 0.2,
    MIDDLE_EXTENSION_POSITION[2],
];
const CANTILEVER_LIGHT_COUNT = 3;
const CANTILEVER_LIGHT_Y = CANTILEVER_OVERHANG_POSITION[1] + 0.08;
const CANTILEVER_LIGHT_Z = CANTILEVER_OVERHANG_POSITION[2] + (CANTILEVER_OVERHANG_SIZE[2] / 2);
const CANTILEVER_LIGHT_POSITIONS = Array.from({ length: CANTILEVER_LIGHT_COUNT }, (_, index) => [
    MIDDLE_EXTENSION_POSITION[0] + (MIDDLE_EXTENSION_SIZE[0] / (CANTILEVER_LIGHT_COUNT + 1)) * (index + 1),
    CANTILEVER_LIGHT_Y,
    CANTILEVER_LIGHT_Z,
]);

const RAILING_DEPTH = 0.25;
const GROUND_SIZE = [1000, 500];
const OCEAN_POSITION = [0, BASE_Y - 0.25, 0];
const OCEAN_SIZE = [1200, 1320];
const OCEAN_SURFACE_OFFSET = 0.02;

const SKYLINE_LAYERS = [
    {
        name: "near",
        count: 55,
        radiusMin: 60,
        radiusMax: 170,
        widthMin: 12,
        widthMax: 24,
        depthMin: 10,
        depthMax: 22,
        heightMin: 24,
        heightMax: 56,
        sectorCount: 10,
        sectorJitter: 0.22,
        tallAccentChance: 0.2,
        setbackChance: 0.6,
        windowChance: 0.92,
        emissiveMin: 0.15,
        emissiveMax: 0.22,
        windowOpacityMin: 0.12,
        windowOpacityMax: 0.2,
    },
    {
        name: "mid",
        count: 46,
        radiusMin: 165,
        radiusMax: 230,
        widthMin: 10,
        widthMax: 22,
        depthMin: 9,
        depthMax: 20,
        heightMin: 20,
        heightMax: 50,
        sectorCount: 12,
        sectorJitter: 0.18,
        tallAccentChance: 0.12,
        setbackChance: 0.45,
        windowChance: 0.84,
        emissiveMin: 0.1,
        emissiveMax: 0.18,
        windowOpacityMin: 0.08,
        windowOpacityMax: 0.16,
    },
    {
        name: "far",
        count: 60,
        radiusMin: 220,
        radiusMax: 260,
        widthMin: 8,
        widthMax: 18,
        depthMin: 8,
        depthMax: 18,
        heightMin: 14,
        heightMax: 40,
        sectorCount: 14,
        sectorJitter: 0.16,
        tallAccentChance: 0.08,
        setbackChance: 0.3,
        windowChance: 0.68,
        emissiveMin: 0.06,
        emissiveMax: 0.14,
        windowOpacityMin: 0.06,
        windowOpacityMax: 0.12,
    },
];

const generateSkylineBuildings = (seed = 20260313) => {
    const rng = createDeterministicRandom(seed);
    const buildings = [];

    SKYLINE_LAYERS.forEach((layer, layerIndex) => {
        // each building picks one sector and gets a random angle inside that slicesector
        const arcPerSector = (Math.PI * 2) / layer.sectorCount; 

        // for each building in layer
        for (let i = 0; i < layer.count; i++) {
            const sector = Math.floor(rng() * layer.sectorCount); // random sector index
            const angle = (sector * arcPerSector) + randomRange(rng, -layer.sectorJitter, layer.sectorJitter); // add some jitter to angle
            const radius = randomRange(rng, layer.radiusMin, layer.radiusMax);

            // multiply x and z by constants to make spawning area ellipse like
            let x = Math.cos(angle) * radius * 1.5; // orig 1.14
            let z = Math.sin(angle) * radius * 0.94;

            // Keep the central play area visually open.
            if (Math.abs(x) < 95 && Math.abs(z) < 95) {
                x *= 1.35;
                z *= 1.35;
            }

            const width = randomRange(rng, layer.widthMin, layer.widthMax);
            const depth = randomRange(rng, layer.depthMin, layer.depthMax);

            let height = randomRange(rng, layer.heightMin, layer.heightMax);
            // chance to make the building a lot taller
            if (rng() < layer.tallAccentChance) {
                height *= randomRange(rng, 1.2, 1.65);
            }

            // a setback is a smaller top section on a builder
            const hasSetback = rng() < layer.setbackChance;
            const setbackHeight = hasSetback ? height * randomRange(rng, 0.15, 0.32) : 0; // make setback height a percentage of height
            const setbackScaleX = randomRange(rng, 0.58, 0.82);
            const setbackScaleZ = randomRange(rng, 0.58, 0.82);
            const setbackOffsetX = randomRange(rng, -width * 0.08, width * 0.08); // setback can shift a little left or right from center
            const setbackOffsetZ = randomRange(rng, -depth * 0.08, depth * 0.08);

            const hasWindows = rng() < layer.windowChance;
            const sideDirection = rng() < 0.5 ? -1 : 1; // determine which side gets the side-window face (-1 = left side, +1 = right side)

            buildings.push({
                id: `${layer.name}-${i}`,
                layerIndex,
                position: [x, z],
                size: [width, height, depth],
                roughness: randomRange(rng, 0.84, 0.98),
                emissiveIntensity: randomRange(rng, layer.emissiveMin, layer.emissiveMax),
                hasSetback,
                setbackSize: [
                    Math.max(2.5, width * setbackScaleX),
                    setbackHeight,
                    Math.max(2.5, depth * setbackScaleZ),
                ],
                setbackOffset: [setbackOffsetX, setbackOffsetZ],
                hasWindows,
                hasFrontWindowFace: hasWindows && rng() < 0.95, // for +z window
                hasSideWindowFace: hasWindows && rng() < 0.72, // for -x or +x window
                sideDirection,
                windowOpacity: randomRange(rng, layer.windowOpacityMin, layer.windowOpacityMax),
                windowEmissiveIntensity: randomRange(rng, 0.35, 0.65),
            });
        }
    });

    return buildings;
};

const SKYLINE_BUILDINGS = generateSkylineBuildings();

const SharedEnvironment = ({ debug = false, isSunset = false, useOceanShaders = false }) => {
    const [colors, setColors] = useState(DEFAULT_COLORS);
    const [skyParams, setSkyParams] = useState(SKY_PARAMS);
    const skyParamsRef = useRef({ ...SKY_PARAMS }); // need this because dat.gui needs a stable object reference to mutate, sine useState setState creates new objects
    const guiRef = useRef(null);

    const { scene: ggbModel } = useGLTF(GGB_URL);

    const showGui = debug || import.meta.env.DEV;

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
        const params = { ...DEFAULT_COLORS };

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
        addFolderColor(skyFolder, "sunsetLight", "Sunset Light Color");
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
        addFolderColor(rooftop, "overhangSlab", "Overhang Slab")
        addFolderColor(rooftop, "canopyLight", "Canopy Light")

        const furniture = gui.addFolder("Furniture");
        furniture.open();
        addFolderColor(furniture, "couchSeat", "Couch Seat");
        addFolderColor(furniture, "couchBack", "Couch Back");
        addFolderColor(furniture, "coffeeTable", "Coffee Table");
        addFolderColor(furniture, "frame", "Frame");

        const plants = gui.addFolder("Plants");
        plants.open();
        addFolderColor(plants, "plant", "Plant");

        const skyline = gui.addFolder("Skyline");
        skyline.open();
        addFolderColor(skyline, "skyline", "Buildings");
        addFolderColor(skyline, "skylineEmissive", "Emissive");
        addFolderColor(skyline, "ground", "Ground");
        addFolderColor(skyline, "ocean", "Ocean");
        addFolderColor(skyline, "oceanHighlight", "Ocean Highlight");

        return () => {
            safeDestroy(guiRef.current);
            guiRef.current = null;
        };
    }, [showGui]);

    return (
        <>
            <color attach="background" args={[colors.background]} />
            <fog attach="fog" args={[colors.fog, 2, 400]} /> 
            
            <ambientLight intensity={0.4}/>
            {/* <hemisphereLight intensity={0.3} groundColor="#2d2f2b" /> */}

            <ambientLight intensity={0.2} />

            <PreethamSky
                isDefaultSky={!isSunset}
                lightColor={isSunset ? colors.sunsetLight : "#ffffff"}
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

                {/* middle extension slab */}
                <Slab 
                    position={MIDDLE_EXTENSION_POSITION}
                    size={MIDDLE_EXTENSION_SIZE}
                    anchor="minXmaxZ"
                    color={colors.rooftopSlab}
                />

                {/* cantilevered overhang for the middle extension */}
                <Slab
                    position={CANTILEVER_OVERHANG_POSITION}
                    size={CANTILEVER_OVERHANG_SIZE}
                    anchor="minXminZ"
                    color={colors.overhangSlab}
                    roughness={0.85}
                    surfaceColor={colors.rooftopSurface}
                />

                {CANTILEVER_LIGHT_POSITIONS.map((position, index) => (
                    <CanopyLight
                        key={`cantilever-light-${index}`}
                        position={position}
                        castShadow={false}
                        lightColor={colors.canopyLight}
                    />
                ))}

                {/* entrance / play area slab */}
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
                args={[RAILING_DEPTH, 1.5, ROOFTOP_SIZE[2] + BULKHEAD_SIZE[2]]} 
                color={colors.railing} 
                anchor="maxXmaxZ"
            />
            <PerimeterRailing 
                position={[-((ROOFTOP_SIZE[0] / 2) - (RAILING_DEPTH / 2)), ROOFTOP_Y, 0]} 
                args={[RAILING_DEPTH, 1.5, ROOFTOP_SIZE[2]]} 
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
                frameColor={colors.frame}
            />

            {/* skyline backdrop */}
            <group>
                {SKYLINE_BUILDINGS.map((building, index) => (
                    <group
                        key={`skyline-${building.id}-${index}`}
                        position={[building.position[0], BASE_Y, building.position[1]]}
                    >
                        <mesh position={[0, building.size[1] / 2, 0]}>
                            <boxGeometry args={building.size} />
                            <meshStandardMaterial
                                color={colors.skyline}
                                roughness={building.roughness}
                                metalness={0.06}
                                emissive={colors.skylineEmissive}
                                emissiveIntensity={building.emissiveIntensity}
                            />
                        </mesh>

                        {building.hasSetback ? (
                            <mesh
                                position={[
                                    building.setbackOffset[0],
                                    building.size[1] + (building.setbackSize[1] / 2),
                                    building.setbackOffset[1],
                                ]}
                            >
                                <boxGeometry args={building.setbackSize} />
                                <meshStandardMaterial
                                    color={colors.skyline}
                                    roughness={Math.min(1, building.roughness + 0.04)}
                                    metalness={0.04}
                                    emissive={colors.skylineEmissive}
                                    emissiveIntensity={building.emissiveIntensity * 0.8}
                                />
                            </mesh>
                        ) : null}

                        {building.hasFrontWindowFace ? (
                            <mesh
                                position={[0, building.size[1] * 0.5, (building.size[2] / 2) + 0.06]}
                            >
                                <boxGeometry args={[building.size[0] * 0.84, building.size[1] * 0.86, 0.06]} />
                                <meshStandardMaterial
                                    color={colors.skylineEmissive}
                                    emissive={colors.skylineEmissive}
                                    emissiveIntensity={building.windowEmissiveIntensity}
                                    transparent
                                    opacity={building.windowOpacity}
                                    roughness={0.4}
                                    metalness={0.12}
                                />
                            </mesh>
                        ) : null}

                        {building.hasSideWindowFace ? (
                            <mesh
                                position={[
                                    building.sideDirection * ((building.size[0] / 2) + 0.06),
                                    building.size[1] * 0.5,
                                    0,
                                ]}
                            >
                                <boxGeometry args={[0.06, building.size[1] * 0.82, building.size[2] * 0.8]} />
                                <meshStandardMaterial
                                    color={colors.skylineEmissive}
                                    emissive={colors.skylineEmissive}
                                    emissiveIntensity={building.windowEmissiveIntensity * 0.85}
                                    transparent
                                    opacity={building.windowOpacity * 0.9}
                                    roughness={0.4}
                                    metalness={0.12}
                                />
                            </mesh>
                        ) : null}
                    </group>
                ))}
            </group>

            {/* distant ground for skyline */}
            <RigidBody type="fixed" colliders={false} position={[0, BASE_Y, 0]}>
                <CuboidCollider args={[GROUND_SIZE[0] / 2, 0.1, GROUND_SIZE[1] / 2]} position={[0, -0.1, 0]} />
                <mesh rotation-x={-Math.PI / 2} receiveShadow>
                    <planeGeometry args={GROUND_SIZE} />
                    <meshStandardMaterial color={colors.ground} roughness={1} />
                </mesh>
            </RigidBody>

            {/* bay/ocean backdrop under the bridge to avoid hard horizon cutoffs */}
            {useOceanShaders ?
                <OceanBackdrop
                    position={OCEAN_POSITION}
                    size={OCEAN_SIZE}
                    color={colors.ocean}
                    highlightColor={colors.oceanHighlight}
                    oceanSurfaceOffset={OCEAN_SURFACE_OFFSET}
                />
                :
                <group position={OCEAN_POSITION}>
                    <mesh rotation-x={-Math.PI / 2} receiveShadow>
                        <planeGeometry args={OCEAN_SIZE} />
                        <meshStandardMaterial
                            color={colors.ocean}
                            roughness={0.35}
                            metalness={0.18}
                        />
                    </mesh>
                    <mesh rotation-x={-Math.PI / 2} position={[0, OCEAN_SURFACE_OFFSET, 0]}>
                        <planeGeometry args={OCEAN_SIZE} />
                        <meshStandardMaterial
                            color={colors.oceanHighlight}
                            roughness={0.2}
                            metalness={0.35}
                            transparent
                            opacity={0.22}
                            emissive={colors.oceanHighlight}
                            emissiveIntensity={0.05}
                        />
                    </mesh>
                </group>
            }
            

            {/* GGB */}
            <primitive 
                object={ggbModel} 
                scale={50} 
                position={[0, BASE_Y + 10, 300]}
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
