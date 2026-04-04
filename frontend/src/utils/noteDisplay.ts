import * as React from "react";
import type { Note } from "musiclib";
import { useAccidentalDisplayPreference } from "./preferences.ts";

export const NOTE_DISPLAY_FONT_FAMILY = '"Noto Sans Symbols 2", "Noto Music", "Segoe UI Symbol", "Apple Symbols", sans-serif';
export const NOTE_DISPLAY_TEXT_SX = {
    fontFamily: NOTE_DISPLAY_FONT_FAMILY,
    fontVariantLigatures: "none",
    fontFeatureSettings: '"liga" 0',
} as const;

const ASCII_ACCIDENTALS = {
    sharp: "#",
    flat: "b",
    doubleSharp: "##",
    doubleFlat: "bb",
} as const;

const UNICODE_ACCIDENTALS = {
    sharp: "♯",
    flat: "♭",
    doubleSharp: "𝄪",
    doubleFlat: "𝄫",
} as const;

function shouldPreferRepeatedDoubleUnicode() {
    if (typeof window === "undefined") {
        return false;
    }

    const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
    const isCoarsePointer = typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;

    return isMobileUserAgent || isCoarsePointer;
}

function getAccidentalSymbols(display: ReturnType<typeof useAccidentalDisplayPreference>[0]) {
    const preferRepeatedDoubleUnicode = shouldPreferRepeatedDoubleUnicode();

    return {
        sharp: display.sharp === "unicode" ? UNICODE_ACCIDENTALS.sharp : ASCII_ACCIDENTALS.sharp,
        flat: display.flat === "unicode" ? UNICODE_ACCIDENTALS.flat : ASCII_ACCIDENTALS.flat,
        doubleSharp: display.doubleSharp === "unicode"
            ? preferRepeatedDoubleUnicode
                ? `${UNICODE_ACCIDENTALS.sharp}${UNICODE_ACCIDENTALS.sharp}`
                : UNICODE_ACCIDENTALS.doubleSharp
            : display.doubleSharp === "repeated-unicode"
                ? `${UNICODE_ACCIDENTALS.sharp}${UNICODE_ACCIDENTALS.sharp}`
                : ASCII_ACCIDENTALS.doubleSharp,
        doubleFlat: display.doubleFlat === "unicode"
            ? preferRepeatedDoubleUnicode
                ? `${UNICODE_ACCIDENTALS.flat}${UNICODE_ACCIDENTALS.flat}`
                : UNICODE_ACCIDENTALS.doubleFlat
            : display.doubleFlat === "repeated-unicode"
                ? `${UNICODE_ACCIDENTALS.flat}${UNICODE_ACCIDENTALS.flat}`
                : ASCII_ACCIDENTALS.doubleFlat,
    };
}

export function formatDisplayNote(note: Pick<Note, "letter" | "alter" | "octave">, display: ReturnType<typeof useAccidentalDisplayPreference>[0]): string {
    const symbols = getAccidentalSymbols(display);
    const accidental = note.alter === 2
        ? symbols.doubleSharp
        : note.alter === 1
            ? symbols.sharp
            : note.alter === -1
                ? symbols.flat
                : note.alter === -2
                    ? symbols.doubleFlat
                    : "";

    return `${note.letter}${accidental}${note.octave ?? ""}`;
}

export function formatDisplayTextAccidentals(value: string, display: ReturnType<typeof useAccidentalDisplayPreference>[0]): string {
    const symbols = getAccidentalSymbols(display);

    return value
        .replace(/##/g, symbols.doubleSharp)
        .replace(/bb/g, symbols.doubleFlat)
        .replace(/#/g, symbols.sharp)
        .replace(/b/g, symbols.flat);
}

export function useNoteFormatter() {
    const [display] = useAccidentalDisplayPreference();

    return React.useMemo(() => {
        return {
            display,
            formatNote: (note: Pick<Note, "letter" | "alter" | "octave">) => formatDisplayNote(note, display),
            formatText: (value: string) => formatDisplayTextAccidentals(value, display),
        };
    }, [display]);
}
