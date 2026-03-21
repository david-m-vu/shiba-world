// const TYPE_CLASSES = {
//     info: "border-white/15 bg-slate-900/75",
//     success: "border-emerald-300/30 bg-emerald-700/80",
//     warning: "border-amber-300/30 bg-amber-700/80",
//     error: "border-rose-300/30 bg-rose-700/80",
// };

const TYPE_CLASSES = {
    info: "bg-amber-300/80",
    success: "bg-emerald-400/80",
    error: "bg-rose-400/80"
}

const Toast = ({
    message, // plain text
    highlightText = "",
    children,
    className = "",
    isVisible = true,
    type = "info"
}) => {
    const displayContent = children ?? message;

    const safeMessage = String(message ?? "");
    const safeHighlightText = String(highlightText ?? "").trim();

    const highlightIndex = safeHighlightText ? safeMessage.indexOf(safeHighlightText) : -1;
    const hasHighlight = highlightIndex >= 0;
    const messageContent = hasHighlight ? (
        <>
            {safeMessage.slice(0, highlightIndex)}
            <span className="text-primary">{safeHighlightText}</span>
            {safeMessage.slice(highlightIndex + safeHighlightText.length)}
        </>
    ) : (
        displayContent
    );

    return (
        <div
            className={[
                "relative pointer-events-auto max-w-sm break-words rounded-2xl border border-[#7F7F7F] bg-[rgba(85,85,85,0.5)] px-4 py-2.5 pr-8 text-sm text-white shadow-lg backdrop-blur-sm",
                "transition-all duration-300 ease-out will-change-transform",
                isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {messageContent}
            <div
                aria-hidden="true" // screen reader ignores this
                className={`absolute right-4 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full ${TYPE_CLASSES[type] ?? TYPE_CLASSES.info}`}
            />
        </div>
    );
};

export default Toast;
