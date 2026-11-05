import type { Step } from "./steps.ts";

export interface Segment {
    /** Play the app's notes from this beat (inclusive)... */
    fromBeat: number;
    /** ...up to this beat (exclusive), at tempo. */
    toBeat: number;
}

export type WaitPressResult =
    | { kind: "correct"; pitch: number; completed: false }
    | { kind: "correct"; pitch: number; completed: true; completedStep: Step; segment: Segment; finished: boolean }
    /** A pitch of this step that was already pressed: neither right nor wrong. */
    | { kind: "repeat"; pitch: number; completed: false }
    | { kind: "wrong"; pitch: number; completed: false }
    | { kind: "ignored"; pitch: number; completed: false };

export interface WaitModeStats {
    expectedNotes: number;
    correct: number;
    wrong: number;
    stepsDone: number;
    userSteps: number;
    wrongByMeasure: Map<number, number>;
}

/**
 * Wait-for-me stepping. The cursor waits at each step with expected notes; it advances once every
 * expected pitch has been pressed, in any order. Wrong notes are counted but don't advance.
 */
export class WaitModeEngine {
    readonly steps: readonly Step[];
    private readonly endBeat: number;
    private readonly userSteps: number[];
    private userIndex = 0;
    private pressed = new Set<number>();
    private correct = 0;
    private wrong = 0;
    private readonly wrongByMeasure = new Map<number, number>();

    constructor(steps: readonly Step[], endBeat: number) {
        this.steps = steps;
        this.endBeat = endBeat;
        this.userSteps = steps.filter((s) => s.expectedPitches.length > 0).map((s) => s.index);
    }

    /** The step I'm expected to play now, or null when finished. */
    get current(): Step | null {
        const index = this.userSteps[this.userIndex];
        return index === undefined ? null : this.steps[index];
    }

    get finished(): boolean {
        return this.userIndex >= this.userSteps.length;
    }

    /** Pitches of the current step already pressed. */
    get pressedPitches(): number[] {
        return [...this.pressed];
    }

    /** What plays before the first step I play (an intro played by the app). */
    initialSegment(): Segment {
        const first = this.current;
        return { fromBeat: this.steps[0]?.beat ?? 0, toBeat: first ? first.beat : this.endBeat };
    }

    press(pitch: number): WaitPressResult {
        const step = this.current;
        if (!step) return { kind: "ignored", pitch, completed: false };
        if (!step.expectedPitches.includes(pitch)) {
            this.wrong++;
            this.wrongByMeasure.set(step.measureIndex, (this.wrongByMeasure.get(step.measureIndex) ?? 0) + 1);
            return { kind: "wrong", pitch, completed: false };
        }
        if (this.pressed.has(pitch)) return { kind: "repeat", pitch, completed: false };
        this.pressed.add(pitch);
        this.correct++;
        if (this.pressed.size < step.expectedPitches.length) return { kind: "correct", pitch, completed: false };

        // Step complete: its accompaniment sounds now, then app-only steps until my next step.
        this.pressed.clear();
        this.userIndex++;
        const next = this.current;
        return {
            kind: "correct",
            pitch,
            completed: true,
            completedStep: step,
            segment: { fromBeat: step.beat, toBeat: next ? next.beat : this.endBeat },
            finished: next === null,
        };
    }

    /** Steps between the completed step and my next one that only the app plays. */
    autoStepsAfter(step: Step): Step[] {
        const next = this.current;
        return this.steps.filter((s) => s.beat > step.beat && (!next || s.beat < next.beat));
    }

    stats(): WaitModeStats {
        return {
            expectedNotes: this.userSteps.reduce((sum, i) => sum + this.steps[i].expectedPitches.length, 0),
            correct: this.correct,
            wrong: this.wrong,
            stepsDone: this.userIndex,
            userSteps: this.userSteps.length,
            wrongByMeasure: new Map(this.wrongByMeasure),
        };
    }
}
