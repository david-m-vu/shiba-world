import ShibaInuFace from "../assets/shiba-inu.png";

export const LANDING_PRIMARY_BUTTON_CLASS = `py-1.5 px-15 rounded-full bg-primary transition-all duration-100 
    hover:cursor-pointer hover:brightness-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] 
    active:scale-[0.99] active:brightness-95 active:shadow-[0_4px_10px_rgba(0,0,0,0.2)] 
    disabled:opacity-70 disabled:hover:cursor-default disabled:hover:brightness-100 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:brightness-100 disabled:active:shadow-none`;

export const LANDING_SECONDARY_BUTTON_CLASS = "text-primary text-xl hover:cursor-pointer underline";

export const LandingShell = ({ headerContent, children }) => {
    return (
        <div className="absolute inset-0 flex flex-col justify-center items-center gap-6">
            {/* Title */}
            <div className="flex flex-row gap-2.5 px-5 py-2.5 justify-center items-center bg-[rgba(246,166,81,0.7)] rounded-4xl">
                <img src={ShibaInuFace} alt="Shiba Inu face" />
                <h1 className="text-[4rem]">SHIBA_WORLD</h1>
            </div>

            {/* Main card */}
            <div className="text-2xl text-center flex flex-col gap-5 px-10 py-10 bg-[rgba(29,29,29,0.7)] rounded-xl w-[clamp(375px,46rem,90vw)]">
                {headerContent}
                <hr />
                {children}
            </div>
        </div>
    );
};

export const NameInputField = ({ inputRef, value, isInvalid, onChange }) => {
    return (
        <div className="flex flex-col gap-2.5">
            <label htmlFor="name">what&apos;s your name?</label>
            <input
                ref={inputRef}
                autoComplete="off"
                type="text"
                name="name"
                id="name"
                placeholder="enter name..."
                value={value}
                required
                aria-invalid={isInvalid}
                className="min-w-90 bg-white rounded-full py-1 px-4 text-black"
                onChange={onChange}
            />
        </div>
    );
};

export const ErrorMessageRow = ({ message }) => {
    return (
        <div className="min-h-6">
            <p
                aria-live="polite"
                className="text-[#FFA2A2] text-base"
            >
                {message}
            </p>
        </div>
    );
};
