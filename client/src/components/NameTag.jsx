/**
 * This file renders a nametag relative to an Avatar (three.js)
 * Styles I'm unsure about: border border-white/22, shadow-[0_8px_20px_rgba(2,6,23,0.35)]
 */
import { Html } from "@react-three/drei";

const NameTag = ({ name = "Anonymous", yOffset = 1.45 }) => {
    const safeName = String(name ?? "").trim() || "Anonymous";

    return (
        <Html
            position={[0, yOffset, 0]}
            center // adds a -50%/-50% css transform
            transform // makes html behave like a real 3d object instead of simple screens-space projection
            sprite // billboard model for Html - when transform is on, it rotates to face the active camera
            distanceFactor={10} // children will be scaled by this. bigger value means it appears larger for a given distance (or shrinks less as camera moves away)
            eps={0.01} // ignore tiny transform deltas to reduce text shimmer
        >
            <div
                className="pointer-events-none select-none max-w-55 overflow-hidden text-ellipsis whitespace-nowrap 
                    rounded-[5px] border border-white/22 bg-slate-900/20 px-2.5 py-[0.05rem] text-[0.5rem] 
                    font-semibold leading-[1.2] tracking-[0.01em] text-slate-50 shadow-[0_8px_20px_rgba(2,6,23,0.35)]"
            >
                {safeName}
            </div>
        </Html>
    );
};

export default NameTag
