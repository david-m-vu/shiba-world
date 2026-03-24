/**
 * 2D UI chat overlay displaying room messages
 */

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore.js";

import ExpandIcon from "../assets/icons/expand_less.svg?react";
import SendIcon from "../assets/icons/send.svg?react";

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

    // if # of messages changes, scroll top edge all the way to the size of the container
    useEffect(() => {
        if (!messagesListRef.current) {
            return;
        }

        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }, [messages.length]);

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
            });
        };

        // capture phase so the shortcut is handled before bubble listeners on window
        window.addEventListener("keydown", handleGlobalChatFocusShortcut, true);
        return () => {
            window.removeEventListener("keydown", handleGlobalChatFocusShortcut, true);
        };
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        event.stopPropagation(); // prevent propagation in the capturing and bubbling phases (like in global keyboard controls)

        setIsChatHidden(false);

        if (isSending) {
            return;
        }

        const safeText = String(draftMessage ?? "").trim();
        if (!safeText) {
            return;
        }

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

    return (
        <div className="pointer-events-none absolute bottom-2 left-2 z-50">
            <section className="pointer-events-auto flex w-[min(95vw,28rem)] flex-col overflow-hidden border border-white/15 bg-[rgba(85,85,85,0.20)] text-white shadow-lg backdrop-blur-xs">
                <header className="flex flex-row justify-between border-b border-white/10 px-3 py-2 text-sm tracking-[0.18em] text-white/85">
                    <p>CHAT</p>
                    {isChatHidden ? 
                        <button
                            type="button"    
                            className="hover:cursor-pointer"
                            onClick={() => setIsChatHidden((prev) => !prev)}
                        >
                            <ExpandIcon className="h-5 w-auto" />
                        </button>   
                        :
                        <button 
                            type="button"
                            className="text-3xl leading-3.5 hover:cursor-pointer"
                            onClick={() => setIsChatHidden((prev) => !prev)}
                        >
                            -
                        </button>
                    }
                    
                </header>

                {!isChatHidden && 
                    <ul
                        ref={messagesListRef}
                        className="chat-scroll flex min-h-40 max-h-64 flex-col gap-2 overflow-y-auto px-2 py-2"
                    >
                        {messages.length === 0 ? (
                            <p className="text-sm text-white/60">No messages yet.</p>
                        ) : (
                            messages.map((message, index) => {
                                const safePlayerId = String(message.playerId ?? "");
                                const safePlayerName = String(
                                    message.playerName ?? playersById[safePlayerId]?.name ?? "Anonymous"
                                ).trim() || "Anonymous";
                                const safeText = String(message.text ?? "").trim();
                                const messageTime = formatMessageTime(message.createdAt);
                                const isOwnMessage = safePlayerId && safePlayerId === selfPlayerId;
                                const messageKey = String(message.id ?? `${safePlayerId}-${message.createdAt ?? index}`);

                                return (
                                    <li
                                        key={messageKey}
                                        className={`rounded-lg border px-2.5 py-1 ${isOwnMessage
                                            ? "border-primary/45 bg-primary/20"
                                            : "border-white/15 bg-white/5"
                                            }`}
                                    >
                                        <div className="mb-1 flex flex-row items-center justify-between gap-2 text-xs">
                                            <span className="truncate text-white/85">
                                                {isOwnMessage ? "You" : safePlayerName}
                                            </span>
                                            {messageTime ? (
                                                <time className="shrink-0 text-white/60">{messageTime}</time>
                                            ) : null}
                                        </div>
                                        <p className="wrap-break-word text-sm leading-5 text-white/95">
                                            {safeText}
                                        </p>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                }

                <form
                    onSubmit={handleSubmit}
                    onKeyDownCapture={(event) => event.stopPropagation()} // stopPropogation here makes it so that window doesn't see these key events that would normally be bubbled up
                    onKeyUpCapture={(event) => event.stopPropagation()} // stopPropogation here makes it so that window doesn't see these key events that would normally be bubbled up
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
