import { BallCollider, RigidBody } from "@react-three/rapier";

const defaultRigidBodyProps = {
    type: "dynamic",
    colliders: false,
    linearDamping: 0.2,
    angularDamping: 0.2,
};

const defaultColliderProps = {
    restitution: 0.8, // 0 = no bounce, 1 = perfectly elastic
    friction: 0.6,
    density: 1,
};

const Soccer = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    radius = 0.65,
    color = "crimson",
    rigidBodyProps = {},
    colliderProps = {},
    ...meshProps
}) => {
    const scaleVec = Array.isArray(scale) ? scale : [scale, scale, scale];
    const effectiveRadius = radius * Math.max(scaleVec[0], scaleVec[1], scaleVec[2]);

    return (
        <RigidBody
            position={position}
            rotation={rotation}
            {...defaultRigidBodyProps}
            {...rigidBodyProps}
        >
            <BallCollider args={[effectiveRadius]} {...defaultColliderProps} {...colliderProps} />
            <mesh scale={scale} castShadow receiveShadow {...meshProps}>
                <sphereGeometry args={[radius, 32, 32]} />
                <meshStandardMaterial color={color} />
            </mesh>
        </RigidBody>
    );
};

export default Soccer;
