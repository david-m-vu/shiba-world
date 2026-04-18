import ShibaInuFace from "../../assets/icons/shiba-inu.png";

const PLAYER_NAME_MAX_LENGTH = 32;

export const LANDING_PRIMARY_BUTTON_CLASS = `py-1.5 px-15 rounded-full bg-primary transition-all duration-100 
    hover:cursor-pointer hover:brightness-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] 
    active:scale-[0.99] active:brightness-95 active:shadow-[0_4px_10px_rgba(0,0,0,0.2)] 
    disabled:opacity-70 disabled:hover:cursor-default disabled:hover:brightness-100 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:brightness-100 disabled:active:shadow-none`;

export const LANDING_SECONDARY_BUTTON_CLASS = "text-primary text-[0.75rem] xs2:text-lg text-xl hover:cursor-pointer underline";

export const LandingShell = ({ headerContent, children, showTitle = true, mainCardClassName = ""}) => {
    return (
        <div className="absolute inset-0 flex flex-col justify-center items-center gap-6">
            {/* Title */}
            {showTitle && 
                <div className="flex flex-row gap-2.5 px-5 py-2.5 justify-center items-center bg-[rgba(246,166,81,0.8)] rounded-4xl">
                    <img className="w-20 xs2:w-22 xs:w-24 sm:w-27.5 sm:h-auto" src={ShibaInuFace} alt="Shiba Inu logo" />
                    <h1 className="text-[2rem] xs2:text-[2.5rem] xs:text-[3rem] sm:text-[4rem]">SHIBA_WORLD</h1>
                </div>
            }
            

            {/* Main card */}
            <div className={`text-[1rem] xs2:text-xl sm:text-2xl text-center flex flex-col gap-5 px-8 py-8 sm:px-10 sm:py-10 bg-[rgba(29,29,29,0.8)] rounded-xl w-[clamp(360px,46rem,90vw)] ${mainCardClassName}`}>
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
                maxLength={PLAYER_NAME_MAX_LENGTH}
                required
                aria-invalid={isInvalid}
                className="min-w-80 xs2:min-w-85 xs:min-w-90 bg-white rounded-full py-1 px-4 text-black"
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
