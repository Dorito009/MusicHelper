import type { NoteEvent } from "./types.ts";

export type HitGrade = "good" | "early" | "late";

export interface ExpectedNote {
    /** Unique per loop pass. */
    key: string;
    notes: NoteEvent[];
    midi: number;
    time: number;
    measureIndex: number;
    iteration: number;
}

export type GradeEvent =
    | { kind: "hit"; grade: HitGrade; expected: ExpectedNote; offsetMs: number; pressTime: number; iteration: number }
    | { kind: "missed"; expected: ExpectedNote; iteration: number }
    | { kind: "extra"; midi: number; time: number; measureIndex: number; iteration: number };

export interface GraderOptions {
    toleranceMs: number;
    /** Ignore pitch; any key counts. Chords count as one onset. */
    rhythmOnly: boolean;
    /** Rhythm only: extra presses this close after a hit are part of the same chord, not "extra". */
    chordWindowMs?: number;
}

interface PendingPress {
    midi: number;
    time: number;
    measureIndex: number;
    iteration: number;
}

/**
 * Play-along grading. Each expected note has a window of ± tolerance. A press of the right pitch
 * matches the earliest unmatched expected note whose window contains it. Within half the tolerance
 * is "good", within the tolerance "early"/"late". A window that passes unmatched is "missed",
 * and a press that matches nothing is "extra". Times must already be latency-compensated.
 */
export class PlayAlongGrader {
    private readonly tolerance: number;
    private readonly rhythmOnly: boolean;
    private readonly chordWindowMs: number;
    private expected: ExpectedNote[] = [];
    private matched = new Set<string>();
    private pending: PendingPress[] = [];
    private lastHitTime = -Infinity;
    readonly events: GradeEvent[] = [];

    constructor(options: GraderOptions) {
        this.tolerance = options.toleranceMs;
        this.rhythmOnly = options.rhythmOnly;
        this.chordWindowMs = options.chordWindowMs ?? 60;
    }

    /** Announces a note I should play at `time` (ms). Grace notes must not be passed in. */
    addExpected(note: NoteEvent, time: number, iteration = 0): GradeEvent[] {
        if (this.rhythmOnly) {
            const same = this.expected.find((e) => e.iteration === iteration && Math.abs(e.time - time) < 1);
            if (same) {
                same.notes.push(note);
                return [];
            }
        }
        const expected: ExpectedNote = {
            key: `${iteration}:${note.id}`,
            notes: [note],
            midi: note.midi,
            time,
            measureIndex: note.measureIndex,
            iteration,
        };
        this.expected.push(expected);
        this.expected.sort((a, b) => a.time - b.time);
        // A press may have come before the note was announced.
        const out: GradeEvent[] = [];
        for (const press of [...this.pending]) {
            if (this.matches(expected, press.midi, press.time)) {
                this.pending.splice(this.pending.indexOf(press), 1);
                out.push(this.hit(expected, press.time));
                break;
            }
        }
        return out;
    }

    /** A key press at `time` (ms). */
    press(midi: number, time: number, measureIndex: number, iteration = 0): GradeEvent[] {
        const candidate = this.expected.find((e) => !this.matched.has(e.key) && this.matches(e, midi, time));
        if (candidate) return [this.hit(candidate, time)];
        if (this.rhythmOnly && time - this.lastHitTime <= this.chordWindowMs) return [];
        this.pending.push({ midi, time, measureIndex, iteration });
        return [];
    }

    /** Settles everything whose window has passed by `now`. */
    advance(now: number): GradeEvent[] {
        const out: GradeEvent[] = [];
        for (const expected of this.expected) {
            if (expected.time + this.tolerance >= now) break;
            if (!this.matched.has(expected.key)) {
                this.matched.add(expected.key);
                const event: GradeEvent = { kind: "missed", expected, iteration: expected.iteration };
                this.events.push(event);
                out.push(event);
            }
        }
        this.expected = this.expected.filter((e) => !this.matched.has(e.key));
        const still: PendingPress[] = [];
        for (const press of this.pending) {
            if (press.time + this.tolerance < now) {
                const event: GradeEvent = { kind: "extra", midi: press.midi, time: press.time, measureIndex: press.measureIndex, iteration: press.iteration };
                this.events.push(event);
                out.push(event);
            } else {
                still.push(press);
            }
        }
        this.pending = still;
        return out;
    }

    /** Unmatched expected pitches with a time between `from` and `to`. */
    upcoming(from: number, to: number): number[] {
        const pitches = new Set<number>();
        for (const expected of this.expected) {
            if (expected.time > to) break;
            if (expected.time >= from && !this.matched.has(expected.key)) for (const n of expected.notes) pitches.add(n.midi);
        }
        return [...pitches];
    }

    /** Settles everything (end of the run). */
    finish(): GradeEvent[] {
        return this.advance(Infinity);
    }

    private matches(expected: ExpectedNote, midi: number, time: number): boolean {
        if (Math.abs(time - expected.time) > this.tolerance) return false;
        return this.rhythmOnly || expected.midi === midi;
    }

    private hit(expected: ExpectedNote, pressTime: number): GradeEvent {
        this.matched.add(expected.key);
        this.lastHitTime = pressTime;
        const offsetMs = pressTime - expected.time;
        const grade: HitGrade = Math.abs(offsetMs) <= this.tolerance / 2 ? "good" : offsetMs < 0 ? "early" : "late";
        const event: GradeEvent = { kind: "hit", grade, expected, offsetMs, pressTime, iteration: expected.iteration };
        this.events.push(event);
        return event;
    }
}
