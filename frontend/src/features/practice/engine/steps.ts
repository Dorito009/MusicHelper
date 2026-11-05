import type { ScoreConfig } from "./scoreConfig.ts";
import type { NoteEvent, ScoreTimeline } from "./types.ts";

/** All new notes at one onset. A step with expected notes waits for me; one without plays on its own. */
export interface Step {
    index: number;
    beat: number;
    measureIndex: number;
    measurePosition: number;
    onsetInMeasure: number;
    /** Notes I play here (new attacks on "I play" staves, no grace notes). */
    expected: NoteEvent[];
    /** Distinct expected pitches. */
    expectedPitches: number[];
    /** Notes the app plays here. */
    accompaniment: NoteEvent[];
}

export function buildSteps(timeline: ScoreTimeline, config: ScoreConfig): Step[] {
    const byBeat = new Map<number, Step>();
    for (const note of timeline.notes) {
        const role = config.staves[note.staffKey]?.role ?? "off";
        if (role === "off" || note.tieContinuation || note.isGrace) continue;
        let step = byBeat.get(note.onsetBeats);
        if (!step) {
            step = {
                index: -1,
                beat: note.onsetBeats,
                measureIndex: note.measureIndex,
                measurePosition: note.measurePosition,
                onsetInMeasure: note.onsetInMeasure,
                expected: [],
                expectedPitches: [],
                accompaniment: [],
            };
            byBeat.set(note.onsetBeats, step);
        }
        if (role === "me") {
            step.expected.push(note);
            if (!step.expectedPitches.includes(note.midi)) step.expectedPitches.push(note.midi);
        } else {
            step.accompaniment.push(note);
        }
    }
    const steps = [...byBeat.values()].sort((a, b) => a.beat - b.beat);
    steps.forEach((step, i) => {
        step.index = i;
        step.expectedPitches.sort((a, b) => a - b);
    });
    return steps;
}
