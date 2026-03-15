const ToggleButton = ({
    enabled = false,
    onToggle,
    onLabel = "On",
    offLabel = "Off",
    ariaLabel,
    disabled = false,
}) => {
    return (
        <button
            type="button"
            aria-pressed={enabled}
            aria-label={ariaLabel}
            onClick={onToggle}
            disabled={disabled}
            className={`min-w-16 rounded-full border px-3 py-1 text-sm leading-none transition-all duration-150 ease-out ${
                enabled
                    ? "border-primary bg-primary text-black"
                    : "border-white/30 bg-white/10 text-white"
            } ${
                disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:opacity-90 active:opacity-80"
            }`}
        >
            {enabled ? onLabel : offLabel}
        </button>
    );
};

export default ToggleButton;
