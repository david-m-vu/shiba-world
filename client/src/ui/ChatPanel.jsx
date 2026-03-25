/**
 * 2D UI chat overlay displaying room messages
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore.js";

import ExpandIcon from "../assets/icons/expand_less.svg?react";
import SendIcon from "../assets/icons/send.svg?react";
import ShibaIcon from "../assets/icons/shiba-icon.png"
import ShibaInuFace from "../assets/icons/shiba-inu.png";

const CHAT_INPUT_MAX_LENGTH = 240;

const formatMessageTime = (value) => {
    if (!value) {
        return "";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    // ex: 07:03 PM
    return parsedDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const ChatPanel = () => {
    const messages = useGameStore((state) => state.messages);
    const playersById = useGameStore((state) => state.playersById);
    const selfPlayerId = useGameStore((state) => state.selfPlayerId);
    const sendChatMessage = useGameStore((state) => state.sendChatMessage);
    const pushToast = useGameStore((state) => state.pushToast);

    const [draftMessage, setDraftMessage] = useState("");
    const [isChatHidden, setIsChatHidden] = useState(true);
    const [isSending, setIsSending] = useState(false);

    const messagesListRef = useRef(null);
    const inputRef = useRef(null);
    const latestMessageId = String(messages[messages.length - 1]?.id ?? "");

    const scrollMessagesToBottom = useCallback(() => {
        if (!messagesListRef.current) {
            return;
        }

        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }, []);

    const toggleChatVisibility = () => {
        setIsChatHidden((previousIsChatHidden) => {
            const nextIsChatHidden = !previousIsChatHidden;

            if (!nextIsChatHidden) {
                window.requestAnimationFrame(() => {
                    scrollMessagesToBottom();
                });
            }

            return nextIsChatHidden;
        });
    };

    // scroll to latest message whenever the newest message id changes
    useEffect(() => {
        window.requestAnimationFrame(() => {
            scrollMessagesToBottom();
        });
    }, [latestMessageId, scrollMessagesToBottom]);

    useEffect(() => {
        const isEditableElement = (element) => {
            if (!(element instanceof HTMLElement)) {
                return false;
            }

            if (element.isContentEditable) {
                return true;
            }

            const tagName = element.tagName;
            return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
        };

        const handleGlobalChatFocusShortcut = (event) => {
            if (event.key === "Escape" && document.activeElement === inputRef.current) {
                event.preventDefault();
                event.stopPropagation();
                inputRef.current.blur();
                return;
            }

            const key = String(event.key ?? "").toLowerCase();
            const isShortcut = event.key === "Enter" || key === "t";
            if (!isShortcut) {
                return;
            }

            const activeElement = document.activeElement;
            if (activeElement === inputRef.current) {
                return;
            }

            // this is to make it so that pressing enter/t won't hijack typing if we're already in an editable field
            // but right now, there is no other editable field that gets rendered simultaneously with the chat input
            if (isEditableElement(activeElement)) {
                return;
            }

            // do this after we know we should handle the key input as focusing the chat
            event.preventDefault();
            event.stopPropagation();
            setIsChatHidden(false);

            if (document.pointerLockElement) {
                try {
                    document.exitPointerLock();
                } catch {
                    // no-op
                }
            }

            // wait for next animation frame because we have to wait one paint tick so React can apply setIsChatHidden(false) first
            // without waiting, we might try to focus the input before it's mounted/visible
            window.requestAnimationFrame(() => {
                if (!inputRef.current) {
                    return;
                }

                inputRef.current.focus();
                const valueLength = inputRef.current.value.length;
                inputRef.current.setSelectionRange(valueLength, valueLength); // set the text cursor/selection at the end of the current message instead of highligting text

                // scroll to bottom
                scrollMessagesToBottom();
            });
        };

        // capture phase so the shortcut is handled before bubble listeners on window
        window.addEventListener("keydown", handleGlobalChatFocusShortcut, true);
        return () => {
            window.removeEventListener("keydown", handleGlobalChatFocusShortcut, true);
        };
    }, [scrollMessagesToBottom]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        event.stopPropagation(); // prevent propagation in the capturing and bubbling phases (like in global keyboard controls)

        if (isSending) {
            return;
        }

        const safeText = String(draftMessage ?? "").trim();
        if (!safeText) {
            return;
        }

        setIsChatHidden(false);

        setIsSending(true);
        const response = await sendChatMessage(safeText);
        setIsSending(false);

        if (!response?.ok) {
            pushToast(response?.message ?? "Failed to send message.", {
                type: "error",
            });
            return;
        }

        setDraftMessage("");
    };

    const handleFormKeyDownCapture = (event) => {
        event.stopPropagation(); // keep key input from reaching global movement/chat shortcuts

        if (event.key !== "Enter") {
            return;
        }

        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (document.activeElement !== inputRef.current) {
            return;
        }

        const safeText = String(draftMessage ?? "").trim();
        if (safeText) {
            return;
        }

        event.preventDefault();
        inputRef.current?.blur();
    };

    return (
        <div className="pointer-events-none absolute bottom-2 left-2 z-50">
            <section className="pointer-events-auto flex w-[min(95vw,28rem)] flex-col overflow-hidden border border-white/15 bg-[rgba(25,25,25,0.2)]
                            text-white shadow-lg backdrop-blur-xs transition-colors focus-within:bg-[rgba(25,25,25,0.6)] hover:bg-[rgba(25,25,25,0.6)]">
                <header className="flex flex-row justify-between border-b border-white/10 px-3 py-2 text-sm tracking-[0.18em] text-white/85">
                    <p>SHIBA_CHAT</p>
                    {isChatHidden ? 
                        <button
                            type="button"    
                            className="hover:cursor-pointer"
                            onClick={toggleChatVisibility}
                        >
                            <ExpandIcon className="h-5 w-auto" />
                        </button>   
                        :
                        <button 
                            type="button"
                            className="text-3xl leading-3.5 hover:cursor-pointer"
                            onClick={toggleChatVisibility}
                        >
                            -
                        </button>
                    }
                    
                </header>

                {!isChatHidden && 
                    <ul
                        ref={messagesListRef}
                        className="chat-scroll flex min-h-40 max-h-80 flex-col gap-2 overflow-y-auto px-2 py-2"
                    >
                        {messages.length === 0 ? (
                            <p className="text-sm text-white/60">No messages yet.</p>
                        ) : (
                            messages.map((message, index) => {
                                const isSystemMessage = message.type === "system";
                                const safePlayerId = String(message.playerId ?? "");
                                const safePlayerName = String(
                                    message.playerName ?? playersById[safePlayerId]?.name ?? "Anonymous"
                                ).trim() || "Anonymous";
                                const safeText = String(message.text ?? "").trim();
                                const messageTime = formatMessageTime(message.createdAt);
                                const isOwnMessage = safePlayerId && safePlayerId === selfPlayerId;
                                const messageKey = String(message.id ?? `${safePlayerId}-${message.createdAt ?? index}`);

                                if (isSystemMessage) {
                                    return (
                                        <li
                                            key={messageKey}
                                            tabIndex={0}
                                            title={safeText}
                                            className="flex items-start gap-2 rounded-lg border border-amber-300/45 bg-amber-500/15 px-2.5 py-1 text-sm
                                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
                                        >
                                            <img className="w-4 h-auto self-center" src={ShibaInuFace} alt="System message icon" />
                                            {/* <span className="shrink-0 tracking-[0.08em] text-amber-100">SYSTEM:</span> */}
                                            <p className="min-w-0 flex-1 wrap-break-word line-clamp-2 italic leading-5 text-amber-100">
                                                {safeText}
                                            </p>
                                            {messageTime ? (
                                                <time className="shrink-0 self-start text-xs leading-5 text-white/60">{messageTime}</time>
                                            ) : null}
                                        </li>
                                    );
                                }

                                return (
                                    <li
                                        key={messageKey}
                                        className={`flex items-start gap-2 rounded-lg border px-2.5 py-1 text-sm ${isOwnMessage
                                            ? "border-primary/45 bg-primary/10"
                                            : "border-white/15 bg-white/5"
                                            }`}
                                    >
                                            <span 
                                                className="truncate text-primary/95"
                                            >
                                                {isOwnMessage ? "You:" : `${safePlayerName}:`}
                                            </span>
                                            <p className="min-w-0 flex-1 wrap-break-word leading-5 text-white/95">
                                                {safeText}
                                            </p>
                                            {messageTime ? (
                                                <time className="shrink-0 self-start text-xs leading-5 text-white/60">{messageTime}</time>
                                            ) : null}
                                        
                                    </li>
                                );
                            })
                        )}
                    </ul>
                }

                <form
                    onSubmit={handleSubmit}
                    onKeyDownCapture={handleFormKeyDownCapture} // stopPropogation here makes it so that window doesn't see these key events that would normally be bubbled up
                    // note we don't have onKeyUpCapture due to issue where if user holds WASD then focuses on chat, the keyUp that triggers movement stop doesn't apply
                    className="flex gap-2 border-t border-white/10 bg-black/20 p-2"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={draftMessage}
                        maxLength={CHAT_INPUT_MAX_LENGTH}
                        placeholder="Click here to chat or press ENTER / T"
                        onChange={(event) => setDraftMessage(event.target.value)}
                        onFocus={(event) => event.stopPropagation()} // so game controls don't react when the user clicks or focus into the chat input
                        onClick={(event) => event.stopPropagation()}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/20 bg-black/25 px-3 pr-9 text-sm text-white outline-none transition-colors placeholder:text-white/45 focus:border-primary/60"
                    />

                    <button
                        type="submit"
                        disabled={isSending || !String(draftMessage ?? "").trim()}
                        className="absolute right-5 h-10 w-auto text-white transition-opacity hover:cursor-pointer hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <SendIcon />
                    </button>
                </form>
            </section>
        </div>
    )
}

export default ChatPanel;
