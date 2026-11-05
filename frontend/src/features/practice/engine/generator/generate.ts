// Sight-reading exercise generator. Produces MusicXML, spelled for the key with musiclib.
import { constructScale, getScaleTypeById, parseNote, type Note, type NoteLetter } from "musiclib";
import { createRandom, type Random } from "./random.ts";

export type ExerciseClef = "treble" | "bass" | "grand";
export type NoteValue = "whole" | "half" | "quarter" | "eighth";

export interface ExerciseOptions {
    clef: ExerciseClef;
    /** Tonic, e.g. "C", "F#", "Bb". */
    tonic: string;
    /** musiclib scale type id: "maj", "min", "dor", "harm"... */
    scaleType: string;
    /** Lowest and highest MIDI note of the melody (right hand). */
    lowest: number;
    highest: number;
    noteValues: NoteValue[];
    dotted: boolean;
    rests: boolean;
    /** Largest melodic leap, in semitones. */
    maxLeap: number;
    /** Notes outside the key. */
    accidentals: boolean;
    timeSignature: { beats: number; beatType: number };
    /** 4-32. */
    measures: number;
    seed: string;
}

export const DEFAULT_EXERCISE_OPTIONS: ExerciseOptions = {
    clef: "treble",
    tonic: "C",
    scaleType: "maj",
    lowest: 60,
    highest: 79,
    noteValues: ["half", "quarter", "eighth"],
    dotted: false,
    rests: true,
    maxLeap: 7,
    accidentals: false,
    timeSignature: { beats: 4, beatType: 4 },
    measures: 8,
    seed: "a1b2c3",
};

/** Quarter-note lengths of the note values. */
const VALUE_BEATS: Record<NoteValue, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5 };
const DIVISIONS = 4; // per quarter note; a dotted eighth is 3

const LETTER_FIFTHS: Record<NoteLetter, number> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
/** Fifths relative to the major key on the same tonic. */
const MODE_FIFTHS: Record<string, { offset: number; mode: string }> = {
    maj: { offset: 0, mode: "major" },
    min: { offset: -3, mode: "minor" },
    harm: { offset: -3, mode: "minor" },
    mel: { offset: -3, mode: "minor" },
    dor: { offset: -2, mode: "dorian" },
    phr: { offset: -4, mode: "phrygian" },
    lyd: { offset: 1, mode: "lydian" },
    mix: { offset: -1, mode: "mixolydian" },
    loc: { offset: -5, mode: "locrian" },
};

const SHARP_ORDER: NoteLetter[] = ["F", "C", "G", "D", "A", "E", "B"];
const NATURAL: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES: Array<[NoteLetter, number]> = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]];
const FLAT_NAMES: Array<[NoteLetter, number]> = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]];

export class GeneratorError extends Error {}

interface Pitch {
    letter: NoteLetter;
    alter: number;
    octave: number;
    midi: number;
}

interface Event {
    /** null = rest. */
    pitches: Pitch[] | null;
    beats: number;
}

function pitchOf(letter: NoteLetter, alter: number, octave: number): Pitch {
    return { letter, alter, octave, midi: (octave + 1) * 12 + NATURAL[letter] + alter };
}

/** Key signature (fifths) and MusicXML mode for a tonic and scale type. */
export function keySignature(tonic: Note, scaleType: string): { fifths: number; mode: string | null } {
    const info = MODE_FIFTHS[scaleType];
    if (!info) return { fifths: 0, mode: null };
    const fifths = LETTER_FIFTHS[tonic.letter] + 7 * tonic.alter + info.offset;
    if (Math.abs(fifths) > 7) {
        throw new GeneratorError("That key needs more than 7 sharps or flats. Pick the enharmonic key instead (for example D♭ instead of C♯).");
    }
    return { fifths, mode: info.mode };
}

/** Alteration the key signature gives each letter. */
function keyAlters(fifths: number): Record<NoteLetter, number> {
    const alters: Record<NoteLetter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
    if (fifths > 0) for (const letter of SHARP_ORDER.slice(0, fifths)) alters[letter] = 1;
    if (fifths < 0) for (const letter of [...SHARP_ORDER].reverse().slice(0, -fifths)) alters[letter] = -1;
    return alters;
}

/** Rhythm values allowed in one measure, longest first. */
function allowedValues(options: ExerciseOptions): number[] {
    const values = new Set<number>();
    for (const value of options.noteValues) {
        values.add(VALUE_BEATS[value]);
        // Dotted half and dotted quarter. A dotted eighth would need a sixteenth to complete the beat.
        if (options.dotted && (value === "half" || value === "quarter")) values.add(VALUE_BEATS[value] * 1.5);
    }
    return [...values].sort((a, b) => b - a);
}

/**
 * Fills one measure with note lengths. A note that starts off the beat must end by the next beat,
 * so rhythms stay readable at sight (no syncopation across beats).
 */
function fillMeasure(length: number, values: number[], beatUnit: number, random: Random): number[] {
    const out: number[] = [];
    let position = 0;
    let guard = 0;
    const fitsAt = (value: number) => {
        if (value > length - position + 1e-9) return false;
        const intoBeat = position % beatUnit;
        return intoBeat < 1e-9 || intoBeat + value <= beatUnit + 1e-9;
    };
    while (position < length - 1e-9 && guard++ < 64) {
        let pool = values.filter(fitsAt);
        // Nothing allowed fits (e.g. only whole notes in 3/4): use the largest standard value that does.
        if (pool.length === 0) pool = [4, 3, 2, 1.5, 1, 0.5].filter(fitsAt);
        const value = pool.length > 0 ? random.pick(pool) : length - position;
        out.push(value);
        position += value;
    }
    return out;
}

/** Generates a sight-reading exercise as MusicXML. The same options and seed always give the same result. */
export function generateExercise(options: ExerciseOptions): { xml: string; title: string } {
    const random = createRandom(options.seed);
    const tonic = parseNote(options.tonic);
    const scaleType = getScaleTypeById(options.scaleType);
    if (!tonic) throw new GeneratorError(`Unknown key: ${options.tonic}`);
    if (!scaleType) throw new GeneratorError(`Unknown scale type: ${options.scaleType}`);
    if (options.noteValues.length === 0) throw new GeneratorError("Choose at least one note value.");
    const measures = Math.min(32, Math.max(4, Math.round(options.measures)));
    const lowest = Math.min(options.lowest, options.highest);
    const highest = Math.max(options.lowest, options.highest);
    if (highest - lowest < 2) throw new GeneratorError("The note range is too small. Leave at least a few notes between the lowest and highest note.");

    const { fifths, mode } = keySignature(tonic, options.scaleType);
    const scale = constructScale(tonic, scaleType);
    const scaleSpellings = scale.notes.map((n) => ({ letter: n.letter, alter: n.alter, pitch: n.pitch }));
    const chromaticNames = fifths < 0 ? FLAT_NAMES : SHARP_NAMES;

    // All pitches in range, spelled for the key.
    const inKey: Pitch[] = [];
    const outOfKey: Pitch[] = [];
    for (let midi = lowest; midi <= highest; midi++) {
        const pc = ((midi % 12) + 12) % 12;
        const spelled = scaleSpellings.find((s) => s.pitch === pc);
        if (spelled) {
            inKey.push(pitchOf(spelled.letter, spelled.alter, octaveFor(spelled.letter, spelled.alter, midi)));
        } else {
            const [letter, alter] = chromaticNames[pc];
            outOfKey.push(pitchOf(letter, alter, octaveFor(letter, alter, midi)));
        }
    }
    if (inKey.length === 0) throw new GeneratorError("No notes of this key fit in the chosen range.");

    const { beats, beatType } = options.timeSignature;
    const measureBeats = (beats * 4) / beatType;
    const values = allowedValues(options);
    const compound = beatType >= 8 && beats > 3 && beats % 3 === 0;
    const beatUnit = compound ? 1.5 : 4 / beatType;
    const tonicPitches = inKey.filter((p) => p.midi % 12 === tonic.pitch);
    const grand = options.clef === "grand";

    // Left hand: simple chords, one or two per measure.
    const progression = grand ? chordProgression(measures, random) : [];
    const leftHand: Event[][] = [];
    const chordPitchClasses: Set<number>[] = [];
    for (let m = 0; m < measures; m++) {
        const degree = progression[m] ?? 0;
        const chord = grand ? leftHandChord(scale.notes, degree) : [];
        chordPitchClasses.push(new Set(chord.map((p) => p.midi % 12)));
        if (!grand) continue;
        const split = measureBeats === 4 && random.next() < 0.5;
        leftHand.push(split ? [{ pitches: chord, beats: 2 }, { pitches: chord, beats: 2 }] : [{ pitches: chord, beats: measureBeats }]);
    }

    // Right hand / single-staff melody: a random walk with mostly small steps.
    const melody: Event[][] = [];
    let previous = tonicPitches.length > 0 ? closest(tonicPitches, (lowest + highest) / 2) : inKey[Math.floor(inKey.length / 2)];
    for (let m = 0; m < measures; m++) {
        const rhythm = fillMeasure(measureBeats, values, beatUnit, random);
        const events: Event[] = [];
        rhythm.forEach((length, i) => {
            const isLast = m === measures - 1 && i === rhythm.length - 1;
            const isFirst = m === 0 && i === 0;
            if (options.rests && !isFirst && !isLast && random.next() < 0.12) {
                events.push({ pitches: null, beats: length });
                return;
            }
            let pool = inKey;
            if (options.accidentals && outOfKey.length > 0 && !isLast && random.next() < 0.12) pool = outOfKey;
            let candidates = pool.filter((p) => Math.abs(p.midi - previous.midi) <= options.maxLeap);
            if (isLast) candidates = tonicPitches.filter((p) => Math.abs(p.midi - previous.midi) <= Math.max(options.maxLeap, 12));
            if (candidates.length === 0) candidates = isLast && tonicPitches.length > 0 ? tonicPitches : inKey;
            const downbeat = i === 0;
            const next = random.weighted(candidates, (p) => {
                const interval = Math.abs(p.midi - previous.midi);
                let weight = interval === 0 ? 0.4 : 1 / interval;
                if (downbeat && chordPitchClasses[m]?.has(p.midi % 12)) weight *= 3;
                return weight;
            });
            events.push({ pitches: [next], beats: length });
            previous = next;
        });
        melody.push(events);
    }

    const title = `Sight-reading in ${options.tonic.replace("#", "♯").replace(/b$/, "♭")} ${scaleType.name}`;
    const xml = writeMusicXml({
        title,
        seed: options.seed,
        fifths,
        mode,
        beats,
        beatType,
        clef: options.clef,
        melody,
        leftHand,
        keyAlters: keyAlters(fifths),
    });
    return { xml, title };
}

function octaveFor(letter: NoteLetter, alter: number, midi: number): number {
    return Math.round((midi - NATURAL[letter] - alter) / 12) - 1;
}

function closest(pitches: Pitch[], midi: number): Pitch {
    return pitches.reduce((best, p) => (Math.abs(p.midi - midi) < Math.abs(best.midi - midi) ? p : best));
}

/** Scale degrees (0-based) per measure: I IV V vi ii, ending on I. */
function chordProgression(measures: number, random: Random): number[] {
    const choices = [0, 3, 4, 5, 1];
    const out: number[] = [];
    for (let m = 0; m < measures; m++) {
        if (m === 0 || m === measures - 1) out.push(0);
        else if (m === measures - 2) out.push(4);
        else out.push(random.pick(choices));
    }
    return out;
}

/** Root-position triad on a scale degree, placed in the left hand (around C3). */
function leftHandChord(scaleNotes: Note[], degree: number): Pitch[] {
    const count = scaleNotes.length;
    const indices = count === 7 ? [degree, degree + 2, degree + 4] : [0];
    const pitches: Pitch[] = [];
    let last = 0;
    for (const index of indices) {
        const note = scaleNotes[index % count];
        const pc = (((NATURAL[note.letter] + note.alter) % 12) + 12) % 12;
        let midi: number;
        if (pitches.length === 0) {
            midi = 48 + pc; // C3..B3
            if (midi > 52) midi -= 12; // root between F2 and E3
        } else {
            // Close position: the next chord tone directly above the previous one.
            midi = last + ((((pc - last) % 12) + 12) % 12 || 12);
        }
        last = midi;
        pitches.push(pitchOf(note.letter, note.alter, octaveFor(note.letter, note.alter, midi)));
    }
    return pitches;
}

// ---------- MusicXML writer ----------

interface WriteInput {
    title: string;
    seed: string;
    fifths: number;
    mode: string | null;
    beats: number;
    beatType: number;
    clef: ExerciseClef;
    melody: Event[][];
    leftHand: Event[][];
    keyAlters: Record<NoteLetter, number>;
}

const TYPE_FOR_BEATS: Record<string, { type: string; dot: boolean }> = {
    "4": { type: "whole", dot: false },
    "3": { type: "half", dot: true },
    "2": { type: "half", dot: false },
    "1.5": { type: "quarter", dot: true },
    "1": { type: "quarter", dot: false },
    "0.75": { type: "eighth", dot: true },
    "0.5": { type: "eighth", dot: false },
};

const ACCIDENTAL_NAMES: Record<number, string> = { [-2]: "flat-flat", [-1]: "flat", 0: "natural", 1: "sharp", 2: "double-sharp" };

function escapeXml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function writeMusicXml(input: WriteInput): string {
    const grand = input.clef === "grand";
    const measureBeats = (input.beats * 4) / input.beatType;
    const compound = input.beatType >= 8 && input.beats % 3 === 0 && input.beats > 3;
    const beamUnit = compound ? 1.5 : 1;
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
    lines.push('<score-partwise version="4.0">');
    lines.push(`  <work><work-title>${escapeXml(input.title)}</work-title></work>`);
    lines.push(`  <identification><creator type="composer">Seed ${escapeXml(input.seed)}</creator><encoding><software>MusicHelper</software></encoding></identification>`);
    lines.push('  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>');
    lines.push('  <part id="P1">');

    input.melody.forEach((events, m) => {
        lines.push(`    <measure number="${m + 1}">`);
        if (m === 0) {
            lines.push("      <attributes>");
            lines.push(`        <divisions>${DIVISIONS}</divisions>`);
            lines.push(`        <key><fifths>${input.fifths}</fifths>${input.mode ? `<mode>${input.mode}</mode>` : ""}</key>`);
            lines.push(`        <time><beats>${input.beats}</beats><beat-type>${input.beatType}</beat-type></time>`);
            if (grand) {
                lines.push("        <staves>2</staves>");
                lines.push('        <clef number="1"><sign>G</sign><line>2</line></clef>');
                lines.push('        <clef number="2"><sign>F</sign><line>4</line></clef>');
            } else if (input.clef === "bass") {
                lines.push("        <clef><sign>F</sign><line>4</line></clef>");
            } else {
                lines.push("        <clef><sign>G</sign><line>2</line></clef>");
            }
            lines.push("      </attributes>");
        }
        writeVoice(lines, events, { voice: 1, staff: grand ? 1 : null, measureBeats, beamUnit, keyAlters: input.keyAlters });
        if (grand) {
            lines.push(`      <backup><duration>${Math.round(measureBeats * DIVISIONS)}</duration></backup>`);
            writeVoice(lines, input.leftHand[m], { voice: 5, staff: 2, measureBeats, beamUnit, keyAlters: input.keyAlters });
        }
        if (m === input.melody.length - 1) lines.push('      <barline location="right"><bar-style>light-heavy</bar-style></barline>');
        lines.push("    </measure>");
    });

    lines.push("  </part>");
    lines.push("</score-partwise>");
    return lines.join("\n") + "\n";
}

function writeVoice(
    lines: string[],
    events: Event[],
    context: { voice: number; staff: number | null; measureBeats: number; beamUnit: number; keyAlters: Record<NoteLetter, number> },
): void {
    // Accidentals carry through the measure per letter and octave.
    const shown = new Map<string, number>();
    const onlyRest = events.length === 1 && events[0].pitches === null;

    // Beam consecutive eighths that start in the same beat.
    const beams: Array<"begin" | "continue" | "end" | null> = events.map(() => null);
    const starts: number[] = [];
    let beat = 0;
    for (const event of events) {
        starts.push(beat);
        beat += event.beats;
    }
    let i = 0;
    while (i < events.length) {
        const group = Math.floor(starts[i] / context.beamUnit + 1e-9);
        let j = i;
        while (j < events.length && events[j].pitches !== null && events[j].beats === 0.5 && Math.floor(starts[j] / context.beamUnit + 1e-9) === group) j++;
        if (j - i >= 2) for (let k = i; k < j; k++) beams[k] = k === i ? "begin" : k === j - 1 ? "end" : "continue";
        i = Math.max(j, i + 1);
    }

    events.forEach((event, i) => {
        const duration = Math.round(event.beats * DIVISIONS);
        const shape = TYPE_FOR_BEATS[String(event.beats)];
        const staff = context.staff !== null ? `<staff>${context.staff}</staff>` : "";
        const typeXml = shape ? `<type>${shape.type}</type>${shape.dot ? "<dot/>" : ""}` : "";
        if (event.pitches === null) {
            const measureRest = onlyRest ? ' measure="yes"' : "";
            lines.push(`      <note><rest${measureRest}/><duration>${duration}</duration><voice>${context.voice}</voice>${onlyRest ? "" : typeXml}${staff}</note>`);
        } else {
            event.pitches.forEach((pitch, k) => {
                const key = `${pitch.letter}${pitch.octave}`;
                const current = shown.has(key) ? shown.get(key)! : context.keyAlters[pitch.letter];
                const accidental = current !== pitch.alter ? `<accidental>${ACCIDENTAL_NAMES[pitch.alter] ?? "natural"}</accidental>` : "";
                shown.set(key, pitch.alter);
                const alter = pitch.alter !== 0 ? `<alter>${pitch.alter}</alter>` : "";
                const beam = k === 0 && beams[i] ? `<beam number="1">${beams[i]}</beam>` : "";
                lines.push(
                    `      <note>${k > 0 ? "<chord/>" : ""}<pitch><step>${pitch.letter}</step>${alter}<octave>${pitch.octave}</octave></pitch>` +
                    `<duration>${duration}</duration><voice>${context.voice}</voice>${typeXml}${accidental}${staff}${beam}</note>`,
                );
            });
        }
    });
}
