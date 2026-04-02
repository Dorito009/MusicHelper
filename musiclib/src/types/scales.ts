import {
    EnharmonicPreference,
    getMidi,
    Note,
    noteFromPitchClass,
    noteFromPitchClassAndLetter, NoteQuality,
    PitchClass,
    simplifyNote,
    sortNaturalNotesFrom,
} from "./notes.js";
import {ScaleType} from "./scaleTypes.js";
import {buildChord, buildScaleSevenths, buildScaleTriads, Chord, detectTriadQuality, simplifyChord} from "./chords.js";
import {ChordTypeId} from "./chordType.js";
import {getChordTypeById} from "../presets/chordTypes.js";

export type ScaleDerivedChordKind = "sus2" | "sus4" | "c6" | "add9" | "c5";
const DERIVED_CHORD_TYPE_BY_KIND: Record<ScaleDerivedChordKind, ChordTypeId> = {
    sus2: "sus2",
    sus4: "sus4",
    "c6": "6",
    add9: "add9",
    "c5": "5",
};

export type ScaleDerivedChords = {
    byKind: Partial<Record<ScaleDerivedChordKind, (Chord | null)[]>>;
};

export type ScaleDegree = {
    degree: number;
    step: number;
    note: Note;
    quality?: NoteQuality;
};

export type ScaleHarmony = {
    triads: Chord[];
    sevenths: Chord[];
}

export type Scale = {
    type: ScaleType;
    tonic: Note;
    notes: Note[];
    degrees: ScaleDegree[];
    harmony?: ScaleHarmony;
    derivedChords?: ScaleDerivedChords;
}

function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function getEnharmonicPreference(tonic: Note): "sharp" | "flat" {
    return tonic.alter < 0 ? "flat" : "sharp";
}

function simplestSpelling(pitchClass: PitchClass, preference: "sharp" | "flat"): Note {
    const preferred = noteFromPitchClass(pitchClass, preference);
    if (Math.abs(preferred.alter) <= 1) return preferred;
    const other = noteFromPitchClass(pitchClass, preference === "flat" ? "sharp" : "flat");
    return Math.abs(other.alter) < Math.abs(preferred.alter) ? other : preferred;
}
function withScaleOctave(note: Note, tonic: Note, step: number): Note {
    const tonicMidi = getMidi(tonic);

    if (tonicMidi === undefined) {
        return note;
    }

    const midi = tonicMidi + step;

    return {
        ...note,
        octave: Math.floor(midi / 12) - 1,
        midi,
    };
}

function spellScaleDegree(
    pitchClass: PitchClass,
    degreeIndex: number,
    tonic: Note,
    type: ScaleType,
    naturalNotes: ReadonlyArray<Readonly<Note>>,
    preference: "sharp" | "flat"
): Note {
    if (type.steps.length !== 7) {
        return simplestSpelling(pitchClass, preference);
    }

    const naturalNote = naturalNotes[degreeIndex];
    const spelledNote = noteFromPitchClassAndLetter(pitchClass, naturalNote.letter);

    if (spelledNote === null) {
        throw new Error(`Cannot spell scale degree ${degreeIndex + 1} for ${type.id} from tonic ${tonic.letter}.`);
    }

    return spelledNote;
}

function buildScaleDegrees(tonic: Note, type: ScaleType): ScaleDegree[] {
    const degrees: ScaleDegree[] = [];
    const enharmonicPreference = getEnharmonicPreference(tonic);
    const naturalNotes = type.steps.length === 7 ? sortNaturalNotesFrom(tonic.letter) : [];

    let currentPitch = tonic.pitch as number;
    let currentStep = 0;

    for (let i = 0; i < type.steps.length; i += 1) {
        const pitchClass = mod(currentPitch, 12) as PitchClass;
        const note = withScaleOctave(
            spellScaleDegree(pitchClass, i, tonic, type, naturalNotes, enharmonicPreference),
            tonic,
            currentStep
        );

        degrees.push({
            degree: i + 1,
            step: currentStep,
            note,
        });

        currentPitch += type.steps[i];
        currentStep += type.steps[i];
    }

    return degrees;
}

function supportsScaleHarmony(type: ScaleType): boolean {
    return type.supportsHarmony ?? true;
}

function addDegreeQualities(degrees: ScaleDegree[]): void {
    for (let i = 0; i < degrees.length; i += 1) {
        const rootPitch = degrees[i].note.pitch as number;
        const thirdPitch = degrees[(i + 2) % degrees.length].note.pitch as number;
        const fifthPitch = degrees[(i + 4) % degrees.length].note.pitch as number;
        const quality = detectTriadQuality(rootPitch, thirdPitch, fifthPitch);

        if (quality) {
            degrees[i].quality = quality;
        }
    }
}

function createScaleBase(tonic: Note, type: ScaleType, degrees: ScaleDegree[]): Scale {
    return {
        type,
        tonic,
        notes: degrees.map((degree) => degree.note),
        degrees,
    };
}

export function constructScale(tonic: Note, type: ScaleType): Scale {
    const degrees = buildScaleDegrees(tonic, type);
    const scale = createScaleBase(tonic, type, degrees);

    if (!supportsScaleHarmony(type)) {
        return scale;
    }

    addDegreeQualities(degrees);

    return {
        ...scale,
        harmony: buildScaleHarmony(scale),
        derivedChords: buildScaleDerivedChords(scale),
    }
}

export function simplifyScale(
    scale: Scale,
    preference: EnharmonicPreference = getEnharmonicPreference(scale.tonic)
): Scale {
    const tonic = simplifyNote(scale.tonic, preference);
    const degrees = scale.degrees.map((degree) => ({
        ...degree,
        note: simplifyNote(degree.note, preference),
    }));

    const harmony = scale.harmony
        ? {
            triads: scale.harmony.triads.map((chord) => simplifyChord(chord, preference)),
            sevenths: scale.harmony.sevenths.map((chord) => simplifyChord(chord, preference)),
        }
        : undefined;

    const derivedChords = scale.derivedChords
        ? {
            byKind: Object.fromEntries(
                Object.entries(scale.derivedChords.byKind).map(([kind, chords]) => [
                    kind,
                    chords?.map((chord) => chord ? simplifyChord(chord, preference) : null),
                ])
            ) as ScaleDerivedChords["byKind"],
        }
        : undefined;

    return {
        ...scale,
        tonic,
        notes: degrees.map((degree) => degree.note),
        degrees,
        harmony,
        derivedChords,
    };
}

function buildScaleHarmony(scale: Scale): ScaleHarmony {
    return {
        triads: buildScaleTriads(scale),
        sevenths: buildScaleSevenths(scale)
    };
}

function isChordInScale(chord: Chord, scale: Scale): boolean {
    const scalePitches = new Set(scale.notes.map((note) => note.pitch));
    return chord.notes.every((note) => scalePitches.has(note.pitch));
}

export function buildScaleDerivedChords(scale: Scale): ScaleDerivedChords {
    const roots = scale.degrees.map((degree) => degree.note);

    const byKind: Partial<Record<ScaleDerivedChordKind, (Chord | null)[]>> = {};

    for (const kind of Object.keys(DERIVED_CHORD_TYPE_BY_KIND) as ScaleDerivedChordKind[]) {
        const chordTypeId = DERIVED_CHORD_TYPE_BY_KIND[kind];
        const chordType = getChordTypeById(chordTypeId);

        if (!chordType) {
            continue;
        }

        byKind[kind] = roots.map((root) => {
            const chord = buildChord(root, chordType);
            return isChordInScale(chord, scale) ? chord : null;
        });
    }

    return { byKind };
}
