// Turns a timeline + staff config into the events the scheduler plays.
import type { ScoreConfig } from "./scoreConfig.ts";
import type { NoteEvent, ScoreTimeline, TempoChange, TimelineMeasure, TimeSignature } from "./types.ts";
import { snapBeats } from "./types.ts";

/** Velocity used when dynamics go out as CC1 only. */
export const CC1_ONLY_VELOCITY = 96;

export type ProgramEvent =
    /** A note the app plays. */
    | { kind: "note"; beat: number; durationBeats: number; channel: number; midi: number; velocity: number; cc1: number | null; noteId: string }
    /** A note I'm expected to play (graded, never sent). */
    | { kind: "expect"; beat: number; note: NoteEvent }
    | { kind: "click"; beat: number; downbeat: boolean; countIn: boolean }
    /** Where the cursor should be. */
    | { kind: "cue"; beat: number; measureIndex: number; measurePosition: number; onsetInMeasure: number };

export interface Program {
    events: ProgramEvent[];
    /** Negative when there is a count-in. */
    startBeat: number;
    endBeat: number;
    tempoChanges: TempoChange[];
}

export interface ProgramOptions {
    countInBars: number;
}

const KIND_ORDER: Record<ProgramEvent["kind"], number> = { cue: 0, click: 1, expect: 2, note: 3 };

/** Metronome beat length (quarters) and beats per bar. 6/8, 9/8 and 12/8 click on dotted quarters. */
export function metronomeUnit(sig: TimeSignature): { unit: number; perBar: number } {
    const compound = sig.beatType >= 8 && sig.beats > 3 && sig.beats % 3 === 0;
    if (compound) return { unit: (3 * 4) / sig.beatType, perBar: sig.beats / 3 };
    return { unit: 4 / sig.beatType, perBar: sig.beats };
}

/** Click positions in one measure. Pickup measures are aligned to the end, so their clicks land on real beats. */
export function measureClicks(measure: TimelineMeasure): { beat: number; downbeat: boolean }[] {
    const { unit } = metronomeUnit(measure.timeSignature);
    const offset = Math.max(0, measure.nominalBeats - measure.durationBeats);
    const clicks: { beat: number; downbeat: boolean }[] = [];
    const first = Math.ceil((offset - 1e-9) / unit) * unit;
    for (let pos = first; pos < measure.nominalBeats - 1e-9; pos += unit) {
        clicks.push({ beat: snapBeats(measure.startBeats + pos - offset), downbeat: Math.abs(pos) < 1e-9 });
    }
    return clicks;
}

export function buildProgram(timeline: ScoreTimeline, config: ScoreConfig, options: ProgramOptions): Program {
    const events: ProgramEvent[] = [];

    for (const note of timeline.notes) {
        const staff = config.staves[note.staffKey];
        if (!staff || staff.role === "off") continue;
        if (note.tieContinuation) continue;
        if (staff.role === "me") {
            if (!note.isGrace) events.push({ kind: "expect", beat: note.onsetBeats, note });
            continue;
        }
        if (note.isGrace) continue; // Grace notes aren't played in v1.
        const sendVelocity = staff.dynamics !== "cc1";
        const sendCc1 = staff.dynamics !== "velocity";
        events.push({
            kind: "note",
            beat: note.onsetBeats,
            durationBeats: note.playDurationBeats,
            channel: staff.channel,
            midi: note.midi,
            velocity: sendVelocity ? note.velocity : CC1_ONLY_VELOCITY,
            cc1: sendCc1 ? note.velocity : null,
            noteId: note.id,
        });
    }

    // Cursor cues: every measure start and every onset of a visible note.
    const seen = new Set<string>();
    const addCue = (measure: TimelineMeasure, onsetInMeasure: number) => {
        const key = `${measure.position}:${onsetInMeasure}`;
        if (seen.has(key)) return;
        seen.add(key);
        events.push({
            kind: "cue",
            beat: snapBeats(measure.startBeats + onsetInMeasure),
            measureIndex: measure.measureIndex,
            measurePosition: measure.position,
            onsetInMeasure,
        });
    };
    for (const note of timeline.notes) {
        const measure = timeline.measures[note.measurePosition];
        if (measure && !note.tieContinuation) addCue(measure, note.onsetInMeasure);
    }
    for (const measure of timeline.measures) addCue(measure, 0);

    // Metronome.
    for (const measure of timeline.measures) {
        for (const click of measureClicks(measure)) events.push({ kind: "click", ...click, countIn: false });
    }

    // Count-in, in the first measure's meter.
    let startBeat = 0;
    const firstMeasure = timeline.measures[0];
    if (firstMeasure && options.countInBars > 0) {
        const { unit, perBar } = metronomeUnit(firstMeasure.timeSignature);
        const beats = options.countInBars * perBar;
        startBeat = -beats * unit;
        for (let i = 0; i < beats; i++) {
            events.push({ kind: "click", beat: snapBeats(startBeat + i * unit), downbeat: i % perBar === 0, countIn: true });
        }
    }

    events.sort((a, b) => a.beat - b.beat || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

    return { events, startBeat, endBeat: timeline.totalBeats, tempoChanges: timeline.tempoChanges };
}
