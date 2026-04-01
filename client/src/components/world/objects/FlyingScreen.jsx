import { useCallback, useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "../../../store/useGameStore.js";
import { getYoutubeIframeApi } from "../../../lib/youtubeIframeApi.js";
import { getEffectiveWatchTimeSec } from "../../../lib/watchTogetherHelpers.js";

const SCREEN_PLAYER_WIDTH_PX = 1600;
const SCREEN_PLAYER_HEIGHT_PX = 900;

const FlyingScreen = ({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    screenSize = [20, 11.25, 0.2],
    screenInset = 0.1,
    frameColor = "#141922",
    screenColor = "black",
    backColor = "gray",
    supportHeight = 0.5,
    supportRadius = 0.12,
    supportColor = "#2b3444",
    rotorLift = 0,
    rotorBladeCount = 3,
    rotorBladeLength = 3,
    rotorBladeWidth = 0.26,
    rotorBladeThickness = 0.09,
    rotorColor = "#1f2835",
    rotorHubColor = "#475569",
    rotorSpinSpeed = 5,
    ...groupProps
}) => {
    const leftRotorRef = useRef(null);
    const rightRotorRef = useRef(null);
    const screenPlayerHostRef = useRef(null);
    const screenPlayerRef = useRef(null);
    const screenPlayerReadyRef = useRef(false);

    const isInRoom = useGameStore((state) => Boolean(state.currentRoomId));
    const watchTogether = useGameStore((state) => state.watchTogether);

    const videoQueue = watchTogether.queue;
    const currentQueueIndex = Number.isInteger(watchTogether.currentQueueIndex) ? watchTogether.currentQueueIndex: -1;
    const playbackStatus = String(watchTogether.playbackStatus ?? "paused").toLowerCase() === "playing" ? "playing" : "paused";
    const playbackRate = Number.isFinite(Number(watchTogether.playbackRate)) ? Number(watchTogether.playbackRate) : 1;
    const anchorTimeSec = Number.isFinite(Number(watchTogether.anchorTimeSec)) ? Number(watchTogether.anchorTimeSec) : 0;
    const anchorServerTsMs = Number.isFinite(Number(watchTogether.anchorServerTsMs)) ? Number(watchTogether.anchorServerTsMs) : 0;

    const currentQueuedVideo = currentQueueIndex >= 0 ? (videoQueue[currentQueueIndex] ?? null) : null;
    const currentVideoId = currentQueuedVideo?.videoId ?? "";

    const frameThickness = screenInset;
    const frameSize = [
        screenSize[0] + frameThickness * 2,
        screenSize[1] + frameThickness * 2,
        screenSize[2] + frameThickness,
    ];

    const screenTopY = frameSize[1] / 2;
    const supportXOffset = (frameSize[0] / 2) - frameThickness * 2;
    const rotorY = screenTopY + supportHeight + rotorLift;
    
    // convert iframe pixel size into world units for Html transform
    // 3d width / pixel width gives us the ratio of 1 world unit to pixels
    const htmlScreenScale = useMemo(() => { // useMemo keeps the array reference stable so the scale prop isn't a new array every render
        return [
            screenSize[0] / SCREEN_PLAYER_WIDTH_PX * 39,
            screenSize[1] / SCREEN_PLAYER_HEIGHT_PX * 39,
            1,
        ];
    }, [screenSize]);

    // exact same syncScreenPlayerToWatchState as the one in WatchTogetherInterface.jsx
    // except theres no need for suppresPlayerEvents() since theres no event handlers that emit back to server that may cayse feedback loops
    const syncScreenPlayerToWatchState = useCallback(() => {
        if (!screenPlayerRef.current || !screenPlayerReadyRef.current || !currentVideoId) {
            return;
        }

        const player = screenPlayerRef.current;
        const loadedVideoId = String(player.getVideoData?.()?.video_id ?? "");

        const effectiveTimeSec = getEffectiveWatchTimeSec({
            playbackStatus,
            playbackRate,
            anchorTimeSec,
            anchorServerTsMs,
        });
        const safeEffectiveTimeSec = Number.isFinite(effectiveTimeSec) ? Math.max(0, effectiveTimeSec) : 0;

        const currentPlayerRate = Number(player.getPlaybackRate?.() ?? 1);
        const currentPlayerTime = Number(player.getCurrentTime?.() ?? 0);
        const currentPlayerState = Number(player.getPlayerState?.());

        if (loadedVideoId !== currentVideoId) {
            if (playbackStatus === "playing") {
                player.loadVideoById({
                    videoId: currentVideoId,
                    startSeconds: safeEffectiveTimeSec,
                });
            } else {
                player.cueVideoById({
                    videoId: currentVideoId,
                    startSeconds: safeEffectiveTimeSec,
                });
                player.pauseVideo?.();
            }

            if (Math.abs(currentPlayerRate - playbackRate) > 0.01) {
                player.setPlaybackRate?.(playbackRate);
            }
            return;
        }

        if (Math.abs(currentPlayerRate - playbackRate) > 0.01) {
            player.setPlaybackRate?.(playbackRate);
        }

        const allowedDrift = playbackStatus === "playing" ? 1.25 : 0.35;
        if (Math.abs(currentPlayerTime - safeEffectiveTimeSec) > allowedDrift) {
            player.seekTo?.(safeEffectiveTimeSec, true);
        }

        if (playbackStatus === "playing") {
            if (currentPlayerState !== window.YT.PlayerState.PLAYING) {
                player.playVideo?.();
            }
            return;
        }

        if (currentPlayerState !== window.YT.PlayerState.PAUSED && currentPlayerState !== window.YT.PlayerState.CUED) {
            player.pauseVideo?.();
        }
    }, [
        anchorServerTsMs,
        anchorTimeSec,
        currentVideoId,
        playbackRate,
        playbackStatus,
    ]);

    useEffect(() => {
        if (!currentVideoId || !screenPlayerHostRef.current || screenPlayerRef.current) {
            return;
        }

        let cancelled = false;

        getYoutubeIframeApi()
            .then((YT) => {
                if (cancelled || !screenPlayerHostRef.current || screenPlayerRef.current) {
                    return;
                }

                screenPlayerRef.current = new YT.Player(screenPlayerHostRef.current, {
                    width: "100%",
                    height: "100%",
                    playerVars: {
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: (event) => {
                            console.log("FlyingScreen.jsx: youtube iframe api ready")
                            screenPlayerReadyRef.current = true;
                            event.target?.mute?.();
                            event.target?.setVolume?.(0);
                            syncScreenPlayerToWatchState();
                        },
                    },
                });
            })
            .catch(() => {
                screenPlayerReadyRef.current = false;
            });

        return () => {
            cancelled = true;
        };
    }, [currentVideoId, syncScreenPlayerToWatchState]);

    // destroy player iframe when theres no currentVideoId, which is when queue is empty
    useEffect(() => {
        if (currentVideoId) {
            return;
        }

        if (screenPlayerRef.current) {
            screenPlayerRef.current.destroy();
            screenPlayerRef.current = null;
        }

        screenPlayerReadyRef.current = false;
    }, [currentVideoId]);

    // sync player state every time zustand watchTogetherState changes
    useEffect(() => {
        console.log("syncing screen player to watch state in FlyingScreen.jsx")
        syncScreenPlayerToWatchState();
    }, [syncScreenPlayerToWatchState]);

    // handle player cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (screenPlayerRef.current) {
                screenPlayerRef.current.destroy();
                screenPlayerRef.current = null;
            }

            screenPlayerReadyRef.current = false;
        };
    }, []);

    useFrame((_state, delta) => {
        const spinDelta = rotorSpinSpeed * delta;

        if (leftRotorRef.current) {
            leftRotorRef.current.rotation.y += spinDelta;
        }

        if (rightRotorRef.current) {
            rightRotorRef.current.rotation.y -= spinDelta;
        }
    });

    const rotorGeometries = Array.from({ length: rotorBladeCount }, (_, index) => (
        <group
            key={`blade-${index}`}
            rotation={[0, (index / rotorBladeCount) * Math.PI * 2, 0]}
        >
            <mesh
                // blade root sits at hub center, then extends outward along +X
                position={[rotorBladeLength / 2, 0, 0]}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[rotorBladeLength, rotorBladeThickness, rotorBladeWidth]} />
                <meshStandardMaterial color={rotorColor} roughness={0.55} metalness={0.28} />
            </mesh>
        </group>
    ));

    return (
        <group
            position={position}
            rotation={rotation}
            scale={scale}
            {...groupProps}
        >
            {/* outer frame */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={frameSize} />
                <meshStandardMaterial color={frameColor} roughness={0.42} metalness={0.3} />
            </mesh>

            {/* front screen panel */}
            <mesh position={[0, 0, (frameSize[2] / 2) + 0.01]} castShadow receiveShadow>
                <boxGeometry args={[screenSize[0], screenSize[1], 0.08]} />
                <meshStandardMaterial
                    color={screenColor}
                    emissive={screenColor}
                    emissiveIntensity={0.08}
                    roughness={0.2}
                    metalness={0.08}
                />
            </mesh>
            
            {isInRoom && 
                <Html
                    transform // projects it onto 3d space
                    position={[0, 0, (frameSize[2] / 2) + 0.06]}
                    scale={htmlScreenScale}
                    style={{
                        pointerEvents: "none",
                        userSelect: "none",
                        WebkitUserSelect: "none",
                    }}
                    zIndexRange={[10, 0]}
                    occlude="blending"
                >
                    <div
                        style={{
                            width: `${SCREEN_PLAYER_WIDTH_PX}px`,
                            height: `${SCREEN_PLAYER_HEIGHT_PX}px`,
                            overflow: "hidden",
                            backgroundColor: "black",
                            pointerEvents: "none",
                        }}
                    >
                        <div
                            ref={screenPlayerHostRef}
                            style={{
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                            }}
                        />
                    </div>
                </Html>
            }

            {/* back panel */}
            <mesh position={[0, 0, -(frameSize[2] / 2) - 0.05]} castShadow receiveShadow>
                <boxGeometry args={[screenSize[0] * 0.96, screenSize[1] * 0.96, 0.1]} />
                <meshStandardMaterial color={backColor} roughness={0.55} metalness={0.18} />
            </mesh>

            {/* support poles */}
            <mesh
                position={[-supportXOffset, screenTopY + supportHeight / 2, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry args={[supportRadius, supportRadius, supportHeight, 16]} />
                <meshStandardMaterial color={supportColor} roughness={0.45} metalness={0.45} />
            </mesh>
            <mesh
                position={[supportXOffset, screenTopY + supportHeight / 2, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry args={[supportRadius, supportRadius, supportHeight, 16]} />
                <meshStandardMaterial color={supportColor} roughness={0.45} metalness={0.45} />
            </mesh>

            {/* left rotor */}
            <group ref={leftRotorRef} position={[-supportXOffset, rotorY, 0]}>
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.24, 0.24, 0.22, 18]} />
                    <meshStandardMaterial color={rotorHubColor} roughness={0.35} metalness={0.55} />
                </mesh>
                {rotorGeometries}
            </group>

            {/* right rotor */}
            <group ref={rightRotorRef} position={[supportXOffset, rotorY, 0]}>
                <mesh castShadow receiveShadow>
                    <cylinderGeometry args={[0.24, 0.24, 0.22, 18]} />
                    <meshStandardMaterial color={rotorHubColor} roughness={0.35} metalness={0.55} />
                </mesh>
                {rotorGeometries}
            </group>
        </group>
    );
};

export default FlyingScreen;
