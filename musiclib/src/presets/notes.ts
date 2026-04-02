import { createNote, parseNote, type Alter, type Note, type NoteLetter, type PitchClass } from "../types/notes.js";

const NOTE_STRING_ROWS: string[][] = [
    ["", "C", "C#"],
    ["Db", "D", "D#"],
    ["Eb", "E", ""],
    ["", "F", "F#"],
    ["Gb", "G", "G#"],
    ["Ab", "A", "A#"],
    ["Bb", "B", ""],
];

const NATURAL_PITCHES: ReadonlyArray<readonly [NoteLetter, PitchClass]> = [
    ["C", 0],
    ["D", 2],
    ["E", 4],
    ["F", 5],
    ["G", 7],
    ["A", 9],
    ["B", 11],
];

const SHARP_PITCHES: ReadonlyArray<readonly [NoteLetter, PitchClass]> = [
    ["C", 1],
    ["D", 3],
    ["F", 6],
    ["G", 8],
    ["A", 10]
]

export const noteRows: ReadonlyArray<ReadonlyArray<Readonly<Note> | null>> = Object.freeze(
    NOTE_STRING_ROWS.map((row) =>
        Object.freeze(
            row.map((value) => {
                const note = parseNote(value);
                return note ? Object.freeze(note) : null;
            })
        )
    )
);

export const naturalNotes: ReadonlyArray<Readonly<Note>> = Object.freeze(
    NATURAL_PITCHES.map(([letter]) =>
        Object.freeze(createNote(letter, 0 as Alter))
    )
);

export const sharpNotes: ReadonlyArray<Readonly<Note>> = Object.freeze(
    SHARP_PITCHES.map(([letter]) =>
        Object.freeze(createNote(letter, 1 as Alter))
    )
);

export const pianoNotes: ReadonlyArray<Readonly<Note>> = Object.freeze(
    [...naturalNotes, ...sharpNotes].sort(
        (a, b) => a.pitch - b.pitch
    )
);
