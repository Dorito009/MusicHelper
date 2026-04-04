export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type NoteQuality = "maj" | "min" | "dim" | "aug"
export type Alter = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type AccidentalFormat = "unicode" | "ascii";
export type EnharmonicPreference = "sharp" | "flat";

export type Note = {
    readonly letter: NoteLetter;
    readonly alter: Alter;
    readonly pitch: PitchClass;
    readonly octave?: number;
    readonly midi?: number;
};

const NATURAL_PITCH: Record<NoteLetter, PitchClass> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
};
const SIMPLE_SHARP: Record<PitchClass, { letter: NoteLetter; alter: Alter }> = {
    0: { letter: "C", alter: 0 },
    1: { letter: "C", alter: 1 },
    2: { letter: "D", alter: 0 },
    3: { letter: "D", alter: 1 },
    4: { letter: "E", alter: 0 },
    5: { letter: "F", alter: 0 },
    6: { letter: "F", alter: 1 },
    7: { letter: "G", alter: 0 },
    8: { letter: "G", alter: 1 },
    9: { letter: "A", alter: 0 },
    10: { letter: "A", alter: 1 },
    11: { letter: "B", alter: 0 },
};
const SIMPLE_FLAT: Record<PitchClass, { letter: NoteLetter; alter: Alter }> = {
    0: { letter: "C", alter: 0 },
    1: { letter: "D", alter: -1 },
    2: { letter: "D", alter: 0 },
    3: { letter: "E", alter: -1 },
    4: { letter: "E", alter: 0 },
    5: { letter: "F", alter: 0 },
    6: { letter: "G", alter: -1 },
    7: { letter: "G", alter: 0 },
    8: { letter: "A", alter: -1 },
    9: { letter: "A", alter: 0 },
    10: { letter: "B", alter: -1 },
    11: { letter: "B", alter: 0 },
};
const ALTER_TO_ASCII: Record<Alter, string> = {
    [-3]: "bbb",
    [-2]: "bb",
    [-1]: "b",
    [0]: "",
    [1]: "#",
    [2]: "##",
    [3]: "###",
};
const ASCII_TO_ALTER: Record<string, Alter> = {
    bbb: -3,
    bb: -2,
    b: -1,
    "": 0,
    "#": 1,
    "##": 2,
    "###": 3,
};
const ALTER_TO_UNICODE: Record<Alter, string> = {
    [-3]: "♭♭♭",
    [-2]: "𝄫",
    [-1]: "♭",
    [0]: "",
    [1]: "♯",
    [2]: "𝄪",
    [3]: "♯♯♯",
};
const UNICODE_TO_ALTER: Record<string, Alter> = {
    "♭♭♭": -3,
    "𝄫♭": -3,
    "♭𝄫": -3,
    "♭♭": -2,
    "𝄫": -2,
    "♭": -1,
    "": 0,
    "♯": 1,
    "♯♯": 2,
    "𝄪": 2,
    "♯♯♯": 3,
    "𝄪♯": 3,
    "♯𝄪": 3,
};
const ACCIDENTAL_TO_ALTER: Record<string, Alter> = {
    ...ASCII_TO_ALTER,
    ...UNICODE_TO_ALTER,
};

function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

export function getPitchClass(letter: NoteLetter, alter: Alter): PitchClass;
export function getPitchClass(note: Pick<Note, "letter" | "alter">): PitchClass;

export function getPitchClass(
    input: NoteLetter | Pick<Note, "letter" | "alter">,
    alter?: Alter
): PitchClass {
    if (typeof input === "string") {
        return mod(NATURAL_PITCH[input] + (alter ?? 0), 12) as PitchClass;
    }

    return getPitchClass(input.letter, input.alter);
}

export function getMidi(note: Pick<Note, "letter" | "alter" | "octave">): number | undefined {
    if (note.octave === undefined) {
        return undefined;
    }

    return (note.octave + 1) * 12 + NATURAL_PITCH[note.letter] + note.alter;
}

export function createNote(letter: NoteLetter, alter: Alter = 0, octave?: number): Note {
    return {
        letter,
        alter,
        pitch: getPitchClass(letter, alter),
        octave,
        midi: getMidi({ letter, alter, octave }),
    };
}

export function formatAccidental(alter: Alter, format: AccidentalFormat = "unicode"): string {
    return format === "ascii" ? ALTER_TO_ASCII[alter] : ALTER_TO_UNICODE[alter];
}

export function formatNote(
    note: Pick<Note, "letter" | "alter" | "octave">,
    options: { accidental?: AccidentalFormat } = {}
): string {
    const accidental = options.accidental ?? "unicode";
    return `${note.letter}${formatAccidental(note.alter, accidental)}${note.octave ?? ""}`;
}

export function parseNote(input: string): Note | null {
    const value = input.trim();

    if (value === "") {
        return null;
    }

    const match = value.match(/^([A-Ga-g])([#b♭♯𝄪𝄫]*)?(-?\d+)?$/u);

    if (!match) {
        return null;
    }

    const [, rawLetter, rawAccidental = "", rawOctave] = match;
    const letter = rawLetter.toUpperCase() as NoteLetter;
    const alter = ACCIDENTAL_TO_ALTER[rawAccidental];

    if (alter === undefined) {
        return null;
    }

    const octave = rawOctave !== undefined ? Number(rawOctave) : undefined;
    return createNote(letter, alter, octave);
}

export function fromPitchClassAndLetter(pitch: PitchClass, letter: NoteLetter): Note | null {
    const natural = NATURAL_PITCH[letter];
    const upward = mod(pitch - natural, 12);

    let alter: Alter | null = null;

    if (upward <= 3) {
        alter = upward as Alter;
    } else if (upward >= 9) {
        alter = (upward - 12) as Alter;
    }

    if (alter === null) {
        return null;
    }

    return createNote(letter, alter);
}

export function fromPitchClass(
    pitch: PitchClass,
    preference: EnharmonicPreference = "sharp"
): Note {
    const table = preference === "flat" ? SIMPLE_FLAT : SIMPLE_SHARP;
    const simple = table[pitch];

    return createNote(simple.letter, simple.alter);
}

export function preserveAbsolutePitch(source: Note, target: Pick<Note, "letter" | "alter" | "pitch">): Note {
    if (source.octave === undefined) {
        return {
            ...target,
            midi: undefined,
        };
    }

    const originalSemitone = NATURAL_PITCH[source.letter] + source.alter;
    const targetSemitone = NATURAL_PITCH[target.letter] + target.alter;

    const originalAbs = source.octave * 12 + originalSemitone;
    let targetAbs = source.octave * 12 + targetSemitone;

    while (targetAbs < originalAbs) {
        targetAbs += 12;
    }

    while (targetAbs - 12 >= originalAbs) {
        targetAbs -= 12;
    }

    const octave = Math.floor(targetAbs / 12);
    return {
        ...target,
        octave,
        midi: getMidi({ letter: target.letter, alter: target.alter, octave }),
    };
}

export function simplifyEnharmonic(
    note: Note,
    preference: EnharmonicPreference = "sharp"
): Note {
    const table = preference === "flat" ? SIMPLE_FLAT : SIMPLE_SHARP;
    const simple = table[note.pitch];

    return preserveAbsolutePitch(note, {
        letter: simple.letter,
        alter: simple.alter,
        pitch: note.pitch,
    });
}

export function simplifyNote(
    note: Note,
    preference: EnharmonicPreference = "sharp"
): Note {
    return simplifyEnharmonic(note, preference);
}

export function sortNaturalNotesFrom(startLetter: NoteLetter): ReadonlyArray<Readonly<Note>> {
    const naturalNotes = [
        createNote("C"),
        createNote("D"),
        createNote("E"),
        createNote("F"),
        createNote("G"),
        createNote("A"),
        createNote("B"),
    ] as const;

    const startIndex = naturalNotes.findIndex((note) => note.letter === startLetter);

    if (startIndex === -1) {
        return naturalNotes;
    }

    return [
        ...naturalNotes.slice(startIndex),
        ...naturalNotes.slice(0, startIndex),
    ];
}


export function formatNoteUnicode(note: Pick<Note, "letter" | "alter" | "octave">): string {
    return formatNote(note, { accidental: "unicode" });
}

export function formatNoteASCII(note: Pick<Note, "letter" | "alter" | "octave">): string {
    return formatNote(note, { accidental: "ascii" });
}

export function noteFromString(input: string): Note | null {
    return parseNote(input);
}

export function noteFromPitchClassAndLetter(pitch: PitchClass, letter: NoteLetter): Note | null {
    return fromPitchClassAndLetter(pitch, letter);
}

export function noteFromPitchClass(
    pitch: PitchClass,
    preference: EnharmonicPreference = "sharp"
): Note {
    return fromPitchClass(pitch, preference);
}
