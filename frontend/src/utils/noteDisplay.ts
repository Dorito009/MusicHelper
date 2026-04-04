import * as React from "react";
import type { Note } from "musiclib";
import type { AccidentalDisplay, DoubleAccidentalDisplay } from "./preferences.ts";
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
const TRIPLE_SHARP_UNICODE = `${UNICODE_ACCIDENTALS.doubleSharp}${UNICODE_ACCIDENTALS.sharp}`;
const TRIPLE_FLAT_UNICODE = `${UNICODE_ACCIDENTALS.doubleFlat}${UNICODE_ACCIDENTALS.flat}`;

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

function getDoubleSharpSymbol(display: DoubleAccidentalDisplay, preferRepeatedDoubleUnicode: boolean): string {
    if (display === "unicode") {
        return preferRepeatedDoubleUnicode
            ? `${UNICODE_ACCIDENTALS.sharp}${UNICODE_ACCIDENTALS.sharp}`
            : UNICODE_ACCIDENTALS.doubleSharp;
    }

    if (display === "repeated-unicode") {
        return `${UNICODE_ACCIDENTALS.sharp}${UNICODE_ACCIDENTALS.sharp}`;
    }

    return ASCII_ACCIDENTALS.doubleSharp;
}

function getDoubleFlatSymbol(display: DoubleAccidentalDisplay, preferRepeatedDoubleUnicode: boolean): string {
    if (display === "unicode") {
        return preferRepeatedDoubleUnicode
            ? `${UNICODE_ACCIDENTALS.flat}${UNICODE_ACCIDENTALS.flat}`
            : UNICODE_ACCIDENTALS.doubleFlat;
    }

    if (display === "repeated-unicode") {
        return `${UNICODE_ACCIDENTALS.flat}${UNICODE_ACCIDENTALS.flat}`;
    }

    return ASCII_ACCIDENTALS.doubleFlat;
}

function getAccidentalSymbols(display: AccidentalDisplay) {
    const preferRepeatedDoubleUnicode = shouldPreferRepeatedDoubleUnicode();
    const doubleSharp = getDoubleSharpSymbol(display.doubleSharp, preferRepeatedDoubleUnicode);
    const doubleFlat = getDoubleFlatSymbol(display.doubleFlat, preferRepeatedDoubleUnicode);

    return {
        sharp: display.sharp === "unicode" ? UNICODE_ACCIDENTALS.sharp : ASCII_ACCIDENTALS.sharp,
        flat: display.flat === "unicode" ? UNICODE_ACCIDENTALS.flat : ASCII_ACCIDENTALS.flat,
        doubleSharp,
        doubleFlat,
        tripleSharp: TRIPLE_SHARP_UNICODE,
        tripleFlat: TRIPLE_FLAT_UNICODE,
    };
}

export function formatDisplayNote(note: Pick<Note, "letter" | "alter" | "octave">, display: AccidentalDisplay): string {
    const symbols = getAccidentalSymbols(display);
    const accidentalByAlter: Record<number, string> = {
        [-3]: symbols.tripleFlat,
        [-2]: symbols.doubleFlat,
        [-1]: symbols.flat,
        [0]: "",
        [1]: symbols.sharp,
        [2]: symbols.doubleSharp,
        [3]: symbols.tripleSharp,
    };
    const accidental = accidentalByAlter[note.alter];

    return `${note.letter}${accidental}${note.octave ?? ""}`;
}

export function formatDisplayTextAccidentals(value: string, display: AccidentalDisplay): string {
    const symbols = getAccidentalSymbols(display);
    const replacements: Record<string, string> = {
        "###": symbols.tripleSharp,
        "bbb": symbols.tripleFlat,
        "##": symbols.doubleSharp,
        "bb": symbols.doubleFlat,
        "#": symbols.sharp,
        b: symbols.flat,
    };

    return value.replace(/###|bbb|##|bb|#|b/g, (match) => replacements[match] ?? match);
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
