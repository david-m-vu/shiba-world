import { useMemo } from "react";
import { Sky } from "@react-three/drei";
import { MathUtils, Vector3 } from "three";

const DEFAULT_PARAMS = {
    distance: 450000,
    sunPosition: [-18, 38, -20],
    turbidity: 7,
    rayleight: 1.1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.85
}

const ExampleSky = ({
    isDefaultSky = false,
    distance = 450000,
    turbidity = 10,
    rayleigh = 3,
    mieCoefficient = 0.005,
    mieDirectionalG = 0.7,
    elevation = 2,
    azimuth = 180,
    ...props
}) => {
    const sunPosition = useMemo(() => {
        const phi = MathUtils.degToRad(90 - elevation);
        const theta = MathUtils.degToRad(azimuth);
        const sun = new Vector3();
        sun.setFromSphericalCoords(1, phi, theta);
        return sun;
    }, [elevation, azimuth]);

    return (
        <> 
            <directionalLight
                castShadow
                intensity={0.9}
                position={isDefaultSky ? DEFAULT_PARAMS.sunPosition : sunPosition}
                shadow-mapSize-width={2048} // horizontal resolution of the shadow texture
                shadow-mapSize-height={2048} // vertical resolution of the shadow texture
                shadow-camera-left={-50}
                shadow-camera-right={50}
                shadow-camera-top={50}
                shadow-camera-bottom={-50}
                shadow-camera-near={1}
                shadow-camera-far={120}
            />
            {isDefaultSky ? 
                <Sky 
                    {...DEFAULT_PARAMS}
                />
                :
                <Sky
                    distance={distance}
                    sunPosition={sunPosition}
                    turbidity={turbidity}
                    rayleigh={rayleigh}
                    mieCoefficient={mieCoefficient}
                    mieDirectionalG={mieDirectionalG}
                    {...props}
                />
            }
        </>
    );
};

export default ExampleSky;
