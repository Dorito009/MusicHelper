import type { TempoChange } from "./types.ts";

export const DEFAULT_TEMPO = 120;

/**
 * Converts between beats and milliseconds for a list of tempo changes.
 * `factor` scales every tempo in the score (1 = as written, 0.5 = half speed),
 * so tempo changes in the score scale proportionally.
 */
export class TempoMap {
    readonly changes: readonly TempoChange[];

    constructor(changes: readonly TempoChange[]) {
        const sorted = [...changes].sort((a, b) => a.beats - b.beats);
        this.changes = sorted.length > 0 ? sorted : [{ beats: 0, bpm: DEFAULT_TEMPO }];
    }

    /** Written tempo (quarter BPM) in effect at a beat. Beats before the first change use the first tempo. */
    bpmAt(beat: number): number {
        let bpm = this.changes[0].bpm;
        for (const change of this.changes) {
            if (change.beats <= beat + 1e-9) bpm = change.bpm;
            else break;
        }
        return bpm;
    }

    /** Milliseconds from `fromBeat` to `toBeat` (negative when toBeat < fromBeat). */
    durationMs(fromBeat: number, toBeat: number, factor: number): number {
        if (toBeat < fromBeat) return -this.durationMs(toBeat, fromBeat, factor);
        let ms = 0;
        let beat = fromBeat;
        while (beat < toBeat - 1e-12) {
            const bpm = this.bpmAt(beat);
            const next = this.nextChangeAfter(beat);
            const segmentEnd = next === null ? toBeat : Math.min(toBeat, next);
            ms += ((segmentEnd - beat) * 60000) / (bpm * factor);
            beat = segmentEnd;
        }
        return ms;
    }

    /** The beat reached `ms` milliseconds after `fromBeat`. */
    beatAfter(fromBeat: number, ms: number, factor: number): number {
        let remaining = ms;
        let beat = fromBeat;
        if (remaining <= 0) {
            return fromBeat + (remaining * this.bpmAt(fromBeat) * factor) / 60000;
        }
        for (;;) {
            const bpm = this.bpmAt(beat) * factor;
            const next = this.nextChangeAfter(beat);
            if (next === null) return beat + (remaining * bpm) / 60000;
            const segmentMs = ((next - beat) * 60000) / bpm;
            if (segmentMs >= remaining) return beat + (remaining * bpm) / 60000;
            remaining -= segmentMs;
            beat = next;
        }
    }

    private nextChangeAfter(beat: number): number | null {
        for (const change of this.changes) {
            if (change.beats > beat + 1e-9) return change.beats;
        }
        return null;
    }
}
