/**
 * Shared 3D scene that is used with LandingPresentationLayer and MultiplayerLayer
 */

import { useEffect, useRef, useState } from "react";
import { Sky } from "@react-three/drei";
import { GUI } from "dat.gui";

import { PerimeterRailing, Couch, CoffeeTable } from "../components/WorldObjects.jsx";

const SUN_POSITION = [18, 28, 10];
const ROOFTOP_SIZE = [50, 40, 20];
const ROOFTOP_Y = 0;
const BASE_Y = -20;
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
    { position: [20, 16, 150], size: [16, 32, 12] },
    { position: [-40, 12, 145], size: [22, 24, 14] },
    { position: [-90, 14, 130], size: [18, 28, 12] },
    { position: [-130, 12, 90], size: [20, 24, 14] },
    { position: [-150, 10, 40], size: [18, 20, 12] },
    { position: [-155, 14, -20], size: [20, 28, 14] },
];
const RAILING_DEPTH = 0.25;
const DEFAULT_COLORS = {
    background: "#9fc4ff",
    fog: "#9fc4ff",
    rooftopSurface: "#E0DCD9",
    rooftopSlab: "#c6e0c7",
    railing: "#314563",
    couchSeat: "#b7927e",
    couchBack: "#b08674",
    coffeeTable: "#8b8278",
    skyline: "#c6e0c7",
    skylineEmissive: "#1a1f2a",
    ground: "#6d747d",
};

const SharedEnvironment = ({ debug = false }) => {
    const showGui = debug || import.meta.env.DEV;
    const [colors, setColors] = useState(DEFAULT_COLORS);
    const guiRef = useRef(null);

    useEffect(() => {
        if (!showGui) return;
        if (guiRef.current) {
            guiRef.current.destroy();
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

        const atmosphere = gui.addFolder("Atmosphere");
        atmosphere.open();
        addFolderColor(atmosphere, "background", "Background");
        addFolderColor(atmosphere, "fog", "Fog");

        const rooftop = gui.addFolder("Rooftop");
        rooftop.open();
        addFolderColor(rooftop, "rooftopSurface", "Surface");
        addFolderColor(rooftop, "rooftopSlab", "Slab");
        addFolderColor(rooftop, "railing", "Railings");

        const furniture = gui.addFolder("Furniture");
        furniture.open();
        addFolderColor(furniture, "couchSeat", "Couch Seat");
        addFolderColor(furniture, "couchBack", "Couch Back");
        addFolderColor(furniture, "coffeeTable", "Coffee Table");

        const skyline = gui.addFolder("Skyline");
        skyline.open();
        addFolderColor(skyline, "skyline", "Buildings");
        addFolderColor(skyline, "skylineEmissive", "Emissive");
        addFolderColor(skyline, "ground", "Ground");

        return () => gui.destroy();
    }, [showGui]);

    return (
        <>
            <color attach="background" args={[colors.background]} />
            <fog attach="fog" args={[colors.fog, 2, 260]} /> 
            
            <ambientLight intensity={0.4}/>
            {/* <hemisphereLight intensity={0.5} groundColor="#2d2f2b" /> */}
            <directionalLight
                castShadow
                intensity={0.9}
                position={SUN_POSITION}
                shadow-mapSize-width={2048} // horizontal resolution of the shadow texture
                shadow-mapSize-height={2048} // vertical resolution of the shadow texture
                shadow-camera-left={-70}
                shadow-camera-right={70}
                shadow-camera-top={70}
                shadow-camera-bottom={-70}
                shadow-camera-near={1}
                shadow-camera-far={120}
            />
            <ambientLight intensity={0.2} />

            <Sky
                distance={450000}
                sunPosition={SUN_POSITION}
                turbidity={7}
                rayleigh={1.1}
                mieCoefficient={0.005}
                mieDirectionalG={0.85}
            />

            {/* rooftop surface */}
            <mesh rotation-x={-Math.PI / 2} position={[0, ROOFTOP_Y + 0.01, 0]} receiveShadow>
                <planeGeometry args={[ROOFTOP_SIZE[0], ROOFTOP_SIZE[2]]} />
                <meshStandardMaterial color={colors.rooftopSurface} roughness={0.75} metalness={0.05} />
            </mesh>

            {/* rooftop slab */}
            <mesh position={[0, ROOFTOP_Y - (ROOFTOP_SIZE[1] / 2), 0]} receiveShadow castShadow>
                <boxGeometry args={ROOFTOP_SIZE} />
                <meshStandardMaterial color={colors.rooftopSlab} roughness={0.8} />
            </mesh>

            {/* front and back railings */}
            <PerimeterRailing 
                position={[0, ROOFTOP_Y, (ROOFTOP_SIZE[2] / 2) - (RAILING_DEPTH / 2)]} 
                args={[ROOFTOP_SIZE[0], 1.2, RAILING_DEPTH]} 
                color={colors.railing} 
            />
            <PerimeterRailing 
                position={[0, ROOFTOP_Y, -((ROOFTOP_SIZE[2] / 2) - (RAILING_DEPTH / 2))]} 
                args={[ROOFTOP_SIZE[0], 1.2, RAILING_DEPTH]} 
                color={colors.railing} 
            />
            {/* left and right railings */}
            <PerimeterRailing 
                position={[(ROOFTOP_SIZE[0] / 2) - (RAILING_DEPTH / 2), ROOFTOP_Y, 0]} 
                args={[RAILING_DEPTH, 1.2, ROOFTOP_SIZE[2]]} 
                color={colors.railing} 
            />
            <PerimeterRailing 
                position={[-((ROOFTOP_SIZE[0] / 2) - (RAILING_DEPTH / 2)), ROOFTOP_Y, 0]} 
                args={[RAILING_DEPTH, 1.2, ROOFTOP_SIZE[2]]} 
                color={colors.railing} 
            />

            {/* lounge seating */}
            <Couch
                position={[8, ROOFTOP_Y + 0.01, 7]}
                seatSize={[6, 0.5, 2]}
                seatColor={colors.couchSeat}
                backColor={colors.couchBack}
            />
            <Couch
                position={[8, ROOFTOP_Y + 0.01, 4]}
                seatSize={[6, 0.5, 2]}
                rotation={[0, Math.PI, 0]}
                seatColor={colors.couchSeat}
                backColor={colors.couchBack}
            />

            {/* coffee tables */}
            <CoffeeTable position={[3.5, ROOFTOP_Y + 0.01, 5.5]} color={colors.coffeeTable} />
            <CoffeeTable position={[12.5, ROOFTOP_Y + 0.01, 5.5]} color={colors.coffeeTable} />

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
            <mesh rotation-x={-Math.PI / 2} position={[0, BASE_Y, 0]} receiveShadow>
                <planeGeometry args={[500, 500]} />
                <meshStandardMaterial color={colors.ground} roughness={1} />
            </mesh>

            {debug ? (
                <>
                    <axesHelper args={[20]} position={[0, 1, 0]} />
                </>
            ) : null}

        </>
    );
};

export default SharedEnvironment;
