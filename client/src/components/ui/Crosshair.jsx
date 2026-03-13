import ShibaIcon from "../../assets/icons/shiba-icon2.png";

const Crosshair = () => {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
        >
            {/* <div className="relative h-8 w-8">
                <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-white/90" />
                <span className="absolute bottom-0 left-1/2 h-3 w-px -translate-x-1/2 bg-white/90" />
                <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/90" />
                <span className="absolute right-0 top-1/2 h-px w-3 -translate-y-1/2 bg-white/90" />
                <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
            </div> */}

            <img className="w-10 h-auto" src={ShibaIcon} alt="" />
        </div>
    );
};

export default Crosshair;
