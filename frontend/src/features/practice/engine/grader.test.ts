import { describe, expect, it } from "vitest";
import { PlayAlongGrader, type GradeEvent } from "./grader.ts";
import { computeStats } from "./stats.ts";
import type { NoteEvent } from "./types.ts";

function note(id: string, midi: number, measureIndex = 0): NoteEvent {
    return {
        id, partId: "P1", staff: 1, staffKey: "P1:1", voice: "1", midi, writtenMidi: midi, step: "C", alter: 0, octave: 4,
        measureIndex, measurePosition: measureIndex, onsetInMeasure: 0, onsetBeats: 0, durationBeats: 1, playDurationBeats: 1,
        velocity: 80, tieContinuation: false, isGrace: false, writtenIndex: 0,
    };
}

const kinds = (events: GradeEvent[]) => events.map((e) => (e.kind === "hit" ? e.grade : e.kind));

describe("PlayAlongGrader", () => {
    it("grades good within half the tolerance, early/late within the tolerance", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        grader.addExpected(note("a", 60), 1000);
        grader.addExpected(note("b", 62), 1500);
        grader.addExpected(note("c", 64), 2000);
        grader.addExpected(note("d", 65), 2500);
        expect(kinds(grader.press(60, 1030, 0))).toEqual(["good"]);
        expect(kinds(grader.press(62, 1450, 0))).toEqual(["good"]); // exactly half the tolerance
        expect(kinds(grader.press(64, 1920, 0))).toEqual(["early"]);
        expect(kinds(grader.press(65, 2580, 0))).toEqual(["late"]);
        const hits = grader.events.filter((e) => e.kind === "hit");
        expect(hits.map((e) => (e.kind === "hit" ? e.offsetMs : 0))).toEqual([30, -50, -80, 80]);
    });

    it("marks a window that passes unmatched as missed, and only once it has passed", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        grader.addExpected(note("a", 60), 1000);
        expect(grader.advance(1100)).toEqual([]);
        expect(kinds(grader.advance(1101))).toEqual(["missed"]);
        expect(grader.advance(5000)).toEqual([]);
    });

    it("marks a press that matches nothing as extra (wrong pitch or outside every window)", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        grader.addExpected(note("a", 60), 1000);
        grader.press(61, 1000, 0); // wrong pitch
        grader.press(60, 1300, 0); // outside the window
        expect(kinds(grader.advance(1150))).toEqual(["missed", "extra"]);
        expect(kinds(grader.finish())).toEqual(["extra"]);
    });

    it("matches a press to the earliest unmatched note whose window contains it", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        // Two repeated notes 120 ms apart: a press at 1060 is in both windows.
        grader.addExpected(note("a", 60), 1000);
        grader.addExpected(note("b", 60), 1120);
        const [first] = grader.press(60, 1060, 0);
        expect(first.kind === "hit" && first.expected.key).toBe("0:a");
        const [second] = grader.press(60, 1110, 0);
        expect(second.kind === "hit" && second.expected.key).toBe("0:b");
    });

    it("grades every note of a chord separately", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        for (const [id, midi] of [["c", 60], ["e", 64], ["g", 67]] as const) grader.addExpected(note(id, midi), 1000);
        expect(kinds(grader.press(64, 990, 0))).toEqual(["good"]);
        expect(kinds(grader.press(60, 1010, 0))).toEqual(["good"]);
        expect(kinds(grader.advance(1200))).toEqual(["missed"]); // G never played
        const stats = computeStats(grader.events, 100, String);
        expect(stats).toMatchObject({ expected: 3, good: 2, missed: 1, extra: 0 });
        expect(stats.accuracy).toBeCloseTo(66.7);
    });

    it("matches a press that arrived before the note was announced", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 150, rhythmOnly: false });
        expect(grader.press(60, 900, 0)).toEqual([]);
        expect(kinds(grader.addExpected(note("a", 60), 1000))).toEqual(["early"]);
        expect(grader.finish()).toEqual([]);
    });

    describe("rhythm only", () => {
        it("ignores pitch: any key counts", () => {
            const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: true });
            grader.addExpected(note("a", 60), 1000);
            grader.addExpected(note("b", 62), 1500);
            expect(kinds(grader.press(30, 1010, 0))).toEqual(["good"]);
            expect(kinds(grader.press(99, 1570, 0))).toEqual(["late"]);
        });

        it("treats a chord as one onset, and a played chord as one press", () => {
            const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: true });
            for (const [id, midi] of [["c", 60], ["e", 64], ["g", 67]] as const) grader.addExpected(note(id, midi), 1000);
            grader.press(60, 1000, 0);
            grader.press(64, 1015, 0); // same chord: ignored
            grader.press(67, 1020, 0);
            grader.finish();
            const stats = computeStats(grader.events, 100, String);
            expect(stats).toMatchObject({ expected: 1, good: 1, extra: 0, missed: 0, accuracy: 100 });
        });
    });
});

describe("computeStats", () => {
    it("computes accuracy, offset mean and spread, histogram and worst measures", () => {
        const grader = new PlayAlongGrader({ toleranceMs: 100, rhythmOnly: false });
        grader.addExpected(note("a", 60, 0), 1000);
        grader.addExpected(note("b", 62, 0), 2000);
        grader.addExpected(note("c", 64, 1), 3000);
        grader.addExpected(note("d", 65, 1), 4000);
        grader.press(60, 1010, 0);
        grader.press(62, 2030, 0);
        grader.press(64, 3070, 1); // late
        grader.press(70, 3500, 1); // extra in measure 1
        grader.finish(); // d missed
        const stats = computeStats(grader.events, 100, (i) => `m${i + 1}`);
        expect(stats).toMatchObject({ expected: 4, good: 2, early: 0, late: 1, missed: 1, extra: 1 });
        expect(stats.accuracy).toBe(60); // 3 hits / (4 expected + 1 extra)
        expect(stats.offsetMeanMs).toBeCloseTo(36.7);
        expect(stats.offsetSpreadMs).toBeCloseTo(24.9, 0);
        expect(stats.histogram).toHaveLength(10);
        expect(stats.histogram.reduce((a, b) => a + b)).toBe(3);
        expect(stats.histogram[5]).toBe(1); // +10 ms
        expect(stats.worstMeasures).toEqual([
            { measureIndex: 1, label: "m2", errors: 2.5 },
        ]);
    });
});
