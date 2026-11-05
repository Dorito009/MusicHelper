import * as React from "react";
import { isTypingTarget, KEYBOARD_INPUT_CODES } from "../midi/keyboardInput.ts";

export interface ShortcutHandlers {
    toggleStart: () => void;
    restart: () => void;
    faster: () => void;
    slower: () => void;
    toggleMetronome: () => void;
    panic: () => void;
}

/**
 * Space start/stop, R restart, +/- tempo, M metronome, Esc panic.
 * None of these are note keys of the computer-keyboard input (A W S E D F T G Y H U J K, Z/X).
 */
export function usePlayerShortcuts(handlers: ShortcutHandlers): void {
    const ref = React.useRef(handlers);
    React.useEffect(() => {
        ref.current = handlers;
    });

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
            if (KEYBOARD_INPUT_CODES.has(event.code)) return;
            const h = ref.current;
            switch (event.code) {
                case "Space":
                    event.preventDefault();
                    if (!event.repeat) h.toggleStart();
                    return;
                case "KeyR":
                    if (event.repeat) return;
                    event.preventDefault();
                    h.restart();
                    return;
                case "KeyM":
                    if (event.repeat) return;
                    event.preventDefault();
                    h.toggleMetronome();
                    return;
                case "Escape":
                    h.panic();
                    return;
                case "NumpadAdd":
                case "Equal":
                    event.preventDefault();
                    h.faster();
                    return;
                case "NumpadSubtract":
                case "Minus":
                    event.preventDefault();
                    h.slower();
                    return;
            }
            if (event.key === "+") {
                event.preventDefault();
                h.faster();
            } else if (event.key === "-") {
                event.preventDefault();
                h.slower();
            }
        };
        // Stop Space from also "clicking" a focused button.
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.code === "Space" && !isTypingTarget(event.target)) event.preventDefault();
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);
}
