import {
    EnharmonicPreference,
    formatNoteASCII,
    getMidi,
    Note,
    noteFromPitchClassAndLetter,
    simplifyNote
} from "./notes.js";
import {ChordType} from "./chordType.js";
import {getChordTypeById} from "../presets/chordTypes.js";
import {Scale} from "./scales.js";

export type ChordToneRole = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9 | 11 | 13

export type ChordTone = {
    role: ChordToneRole,
    interval: number,
    note: Note
}

export type Chord = {
    root: Note;
    type: ChordType;
    tones: ChordTone[];
    notes: Note[];
    symbol: string;
    inversion?: number;
    bass?: Note;
};


function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function detectTriadType(rootPitch: number, thirdPitch: number, fifthPitch: number): ChordType | undefined {
    const rootToThird = mod(thirdPitch - rootPitch, 12);
    const rootToFifth = mod(fifthPitch - rootPitch, 12);

    if (rootToThird === 4 && rootToFifth === 7) return getChordTypeById("maj");
    if (rootToThird === 3 && rootToFifth === 7) return getChordTypeById("min");
    if (rootToThird === 3 && rootToFifth === 6) return getChordTypeById("dim");
    if (rootToThird === 4 && rootToFifth === 8) return getChordTypeById("aug");

    return undefined;
}
function detectSeventhType(rootPitch: number, thirdPitch: number, fifthPitch: number, seventhPitch: number): ChordType | undefined {
    const rootToThird = mod(thirdPitch - rootPitch, 12);
    const rootToFifth = mod(fifthPitch - rootPitch, 12);
    const rootToSeventh = mod(seventhPitch - rootPitch, 12);

    if (rootToThird === 4 && rootToFifth === 7 && rootToSeventh === 10) return getChordTypeById("7");
    if (rootToThird === 4 && rootToFifth === 7 && rootToSeventh === 11) return getChordTypeById("maj7");
    if (rootToThird === 3 && rootToFifth === 7 && rootToSeventh === 10) return getChordTypeById("m7");
    if (rootToThird === 3 && rootToFifth === 6 && rootToSeventh === 10) return getChordTypeById("m7b5");
    if (rootToThird === 3 && rootToFifth === 6 && rootToSeventh === 9) return getChordTypeById("dim7");

    return undefined;
}
function buildStackedChord(root: Note, type: ChordType, notes: Note[]): Chord {
    return {
        root,
        type,
        notes,
        tones: type.intervals.map((interval, index) => ({
            role: ([1, 3, 5, 7] as const)[index] ?? 1,
            interval,
            note: notes[index]
        })),
        symbol: `${formatNoteASCII(root)}${type.shortName}`
    };
}

export function simplifyChord(
    chord: Chord,
    preference: EnharmonicPreference
): Chord {
    const root = simplifyNote(chord.root, preference);
    const notes = chord.notes.map((note) => simplifyNote(note, preference));

    return {
        ...chord,
        root,
        notes,
        tones: chord.tones.map((tone, index) => ({
            ...tone,
            note: notes[index] ?? simplifyNote(tone.note, preference),
        })),
        bass: chord.bass ? simplifyNote(chord.bass, preference) : undefined,
        symbol: `${formatNoteASCII(root)}${chord.type.shortName}`,
    };
}
export function buildScaleTriads(scale: Scale): Chord[] {
    const notes = scale.degrees.map((degree) => degree.note);
    const triads: Chord[] = [];

    for (let i = 0; i < notes.length; i += 1) {
        const root = notes[i];
        const third = notes[(i + 2) % notes.length];
        const fifth = notes[(i + 4) % notes.length];

        const type = detectTriadType(root.pitch, third.pitch, fifth.pitch);

        if (!type) {
            continue;
        }

        triads.push(buildStackedChord(root, type, [root, third, fifth]));
    }

    return triads;
}
export function buildScaleSevenths(scale: Scale): Chord[] {
    const notes = scale.degrees.map((degree) => degree.note);
    const sevenths: Chord[] = [];

    for (let i = 0; i < notes.length; i += 1) {
        const root = notes[i];
        const third = notes[(i + 2) % notes.length];
        const fifth = notes[(i + 4) % notes.length];
        const seventh = notes[(i + 6) % notes.length];

        const type = detectSeventhType(root.pitch, third.pitch, fifth.pitch, seventh.pitch);

        if (!type) {
            continue;
        }

        sevenths.push(buildStackedChord(root, type, [root, third, fifth, seventh]));
    }

    return sevenths;
}

const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

function getChordToneRole(interval: number): ChordToneRole {
    const normalized = mod(interval, 12);

    if (interval === 0) return 1;
    if (normalized === 2) return interval >= 12 ? 9 : 2;
    if (normalized === 4 || normalized === 3) return 3;
    if (normalized === 5) return 4;
    if (normalized === 7 || normalized === 6 || normalized === 8) return 5;
    if (normalized === 9) return interval >= 12 ? 13 : 6;
    if (normalized === 10 || normalized === 11) return 7;

    return 1;
}

function stepLetter(letter: Note["letter"], diatonicSteps: number): Note["letter"] {
    const index = NOTE_LETTERS.indexOf(letter);
    return NOTE_LETTERS[(index + diatonicSteps) % NOTE_LETTERS.length];
}

function buildChordToneNote(root: Note, interval: number): Note {
    const role = getChordToneRole(interval);

    const diatonicStepsByRole: Record<ChordToneRole, number> = {
        1: 0,
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
        7: 6,
        9: 1,
        11: 3,
        13: 5,
    };

    const letter = stepLetter(root.letter, diatonicStepsByRole[role]);
    const pitch = mod(root.pitch + interval, 12) as Note["pitch"];
    const note = noteFromPitchClassAndLetter(pitch, letter);

    if (!note) {
        throw new Error(`Cannot spell chord tone for ${formatNoteASCII(root)} at interval ${interval}.`);
    }

    const rootMidi = getMidi(root);
    if (rootMidi === undefined) {
        return note;
    }

    const midi = rootMidi + interval;
    return {
        ...note,
        octave: Math.floor(midi / 12) - 1,
        midi,
    };
}

export function buildChord(root: Note, type: ChordType): Chord {
    const tones = type.intervals.map((interval) => {
        const note = buildChordToneNote(root, interval);

        return {
            role: getChordToneRole(interval),
            interval,
            note,
        };
    });

    return {
        root,
        type,
        tones,
        notes: tones.map((tone) => tone.note),
        symbol: `${formatNoteASCII(root)}${type.shortName}`,
    };
}