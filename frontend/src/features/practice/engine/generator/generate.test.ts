import { describe, expect, it } from "vitest";
import { DEFAULT_EXERCISE_OPTIONS, generateExercise, GeneratorError, keySignature, type ExerciseOptions } from "./generate.ts";
import { parseMusicXml } from "../musicxml.ts";
import { buildTimeline } from "../timeline.ts";
import { parseNote } from "musiclib";

function make(overrides: Partial<ExerciseOptions> = {}) {
    const options = { ...DEFAULT_EXERCISE_OPTIONS, ...overrides };
    const { xml, title } = generateExercise(options);
    const score = parseMusicXml(xml);
    return { options, xml, title, score, timeline: buildTimeline(score) };
}

const spelled = (notes: { step: string; alter: number }[]) => new Set(notes.map((n) => `${n.step}${n.alter}`));

describe("sight-reading generator", () => {
    it("produces valid MusicXML with full measures", () => {
        for (const timeSignature of [{ beats: 4, beatType: 4 }, { beats: 3, beatType: 4 }, { beats: 2, beatType: 4 }, { beats: 6, beatType: 8 }]) {
            const { xml, score } = make({ timeSignature, measures: 12, dotted: true, seed: `sig-${timeSignature.beats}` });
            expect(new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("parsererror")).toHaveLength(0);
            expect(score.measures).toHaveLength(12);
            for (const measure of score.measures) expect(measure.durationBeats).toBeCloseTo(measure.nominalBeats);
            expect(score.notes.length).toBeGreaterThan(0);
        }
    });

    it("keeps the melody inside the chosen range and leaps inside the limit", () => {
        for (const seed of ["r1", "r2", "r3", "r4"]) {
            const { timeline } = make({ lowest: 62, highest: 74, maxLeap: 4, measures: 16, seed, rests: false });
            const midis = timeline.notes.map((n) => n.midi);
            expect(Math.min(...midis)).toBeGreaterThanOrEqual(62);
            expect(Math.max(...midis)).toBeLessThanOrEqual(74);
            for (let i = 1; i < midis.length - 1; i++) expect(Math.abs(midis[i] - midis[i - 1])).toBeLessThanOrEqual(4);
        }
    });

    it("spells notes for the key (F major uses B flat, D major uses F and C sharp)", () => {
        const f = make({ tonic: "F", measures: 32, seed: "spell-f", lowest: 60, highest: 84 });
        const fNotes = spelled(f.timeline.notes);
        expect([...fNotes].every((n) => ["F0", "G0", "A0", "B-1", "C0", "D0", "E0"].includes(n))).toBe(true);
        expect(f.xml).toContain("<fifths>-1</fifths>");

        const d = make({ tonic: "D", measures: 32, seed: "spell-d", lowest: 60, highest: 84 });
        expect([...spelled(d.timeline.notes)].every((n) => ["D0", "E0", "F1", "G0", "A0", "B0", "C1"].includes(n))).toBe(true);
        expect(d.xml).toContain("<fifths>2</fifths>");
        // The key signature already shows the sharps, so no accidental is printed for them.
        expect(d.xml).not.toContain("<accidental>sharp</accidental>");
    });

    it("spells the raised seventh of harmonic minor as G sharp in A minor, with an accidental", () => {
        const { timeline, xml } = make({ tonic: "A", scaleType: "harm", measures: 32, seed: "harm", lowest: 64, highest: 81 });
        const names = spelled(timeline.notes);
        expect(names.has("A-1")).toBe(false);
        expect([...names].every((n) => ["A0", "B0", "C0", "D0", "E0", "F0", "G1"].includes(n))).toBe(true);
        expect(xml).toContain("<fifths>0</fifths><mode>minor</mode>");
        if (names.has("G1")) expect(xml).toContain("<accidental>sharp</accidental>");
    });

    it("adds notes outside the key only when accidentals are on", () => {
        const scale = new Set(["C0", "D0", "E0", "F0", "G0", "A0", "B0"]);
        const off = make({ measures: 32, seed: "acc", accidentals: false });
        expect([...spelled(off.timeline.notes)].every((n) => scale.has(n))).toBe(true);
        const on = make({ measures: 32, seed: "acc", accidentals: true });
        expect([...spelled(on.timeline.notes)].some((n) => !scale.has(n))).toBe(true);
    });

    it("ends on the tonic", () => {
        for (const seed of ["e1", "e2", "e3"]) {
            const { timeline } = make({ tonic: "G", seed });
            const last = timeline.notes[timeline.notes.length - 1];
            expect(last.midi % 12).toBe(7);
        }
    });

    it("writes a grand staff with simple left-hand chords in longer values", () => {
        const { score, timeline } = make({ clef: "grand", measures: 8, seed: "grand" });
        expect(score.staves.map((s) => [s.key, s.clef])).toEqual([["P1:1", "G"], ["P1:2", "F"]]);
        const left = timeline.notes.filter((n) => n.staff === 2);
        expect(left.length).toBeGreaterThan(0);
        expect(left.every((n) => n.durationBeats >= 2)).toBe(true);
        expect(left.every((n) => n.midi < 60)).toBe(true);
        // First and last chords are the tonic triad (C E G).
        const firstChord = left.filter((n) => n.onsetBeats === 0).map((n) => n.midi % 12).sort((a, b) => a - b);
        expect(firstChord).toEqual([0, 4, 7]);
    });

    it("uses only the allowed note values", () => {
        const { timeline } = make({ noteValues: ["quarter"], rests: false, dotted: false, seed: "q" });
        expect(new Set(timeline.notes.map((n) => n.durationBeats))).toEqual(new Set([1]));
    });

    it("gives the same output for the same seed and a different one for another seed", () => {
        expect(make({ seed: "same" }).xml).toBe(make({ seed: "same" }).xml);
        expect(make({ seed: "same" }).xml).not.toBe(make({ seed: "other" }).xml);
    });

    it("rejects keys with more than 7 sharps or flats", () => {
        expect(() => keySignature(parseNote("G#")!, "maj")).toThrow(GeneratorError);
        expect(keySignature(parseNote("Db")!, "maj")).toEqual({ fifths: -5, mode: "major" });
        expect(keySignature(parseNote("E")!, "dor")).toEqual({ fifths: 2, mode: "dorian" });
    });
});

describe("readable rhythms", () => {
    it("never lets a note that starts off the beat cross the next beat", () => {
        for (const seed of ["b1", "b2", "b3", "b4", "b5"]) {
            const { timeline } = make({ seed, measures: 16, dotted: true });
            for (const note of timeline.notes) {
                const intoBeat = note.onsetInMeasure % 1;
                if (intoBeat > 1e-9) expect(intoBeat + note.durationBeats).toBeLessThanOrEqual(1 + 1e-9);
            }
        }
    });
});
