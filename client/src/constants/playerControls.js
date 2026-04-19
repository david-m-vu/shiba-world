export const AVATAR_POSITION_OFFSET = [0, 0, 0]
export const AVATAR_ESTIMATE_SIZE = [1, 1, 1]

export const LOCAL_MOVE_SPEED = 12; // originally 8
export const TURN_SPEED = 8;
export const JUMP_IMPULSE = 6; // orig 6.5
export const HIDE_DISTANCE = 1.4;

export const INITIAL_WORLD_CAMERA_POSITION = [0, 6.5, -5];
export const CAMERA_TARGET_Y_OFFSET = 0.8;
export const CAMERA_LOCK_TARGET_Y_OFFSET = 1.3;
export const CAMERA_MIN_DISTANCE = 0.3;
export const CAMERA_MAX_DISTANCE = 100;
export const CAMERA_WHEEL_ZOOM_SPEED = 0.0002; // 0.00042 is equal step distance
export const POINTER_LOOK_SENSITIVITY = 0.005;
export const POINTER_LOOK_MIN_PITCH = -Math.PI / 3;
export const POINTER_LOOK_MAX_PITCH = Math.PI / 3;

export const GROUND_RAY_OFFSET = 0.05;
export const GROUND_RAY_LENGTH = 0.25;
export const FOOT_RAY_RADIUS = 0.35;
export const FOOT_RAY_OFFSETS = [
    [0, 0],
    [FOOT_RAY_RADIUS, FOOT_RAY_RADIUS],
    [FOOT_RAY_RADIUS, -FOOT_RAY_RADIUS],
    [-FOOT_RAY_RADIUS, FOOT_RAY_RADIUS],
    [-FOOT_RAY_RADIUS, -FOOT_RAY_RADIUS],
];

export const INITIAL_CAMERA_DISTANCE = 6;
export const EPSILON = 0.0001; // “Epsilon” conventioanlly means a very small threshold value used for numeric tolerance.
