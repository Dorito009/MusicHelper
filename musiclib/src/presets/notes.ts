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
