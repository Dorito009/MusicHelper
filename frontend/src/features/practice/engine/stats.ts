import type { GradeEvent } from "./grader.ts";

export interface WorstMeasure {
    /** Written measure index. */
    measureIndex: number;
    /** Measure number as printed. */
    label: string;
    errors: number;
}

export interface SessionStats {
    /** Notes I was expected to play (onsets, in rhythm-only mode). */
    expected: number;
    good: number;
    early: number;
    late: number;
    missed: number;
    extra: number;
    /** Wrong notes pressed in wait-for-me mode. */
    wrong: number;
    /** Hits within the tolerance / (expected + extra), in %. */
    accuracy: number;
    offsetMeanMs: number | null;
    /** Standard deviation of the offsets. */
    offsetSpreadMs: number | null;
    worstMeasures: WorstMeasure[];
    /** Offset counts per bin, from -tolerance to +tolerance. */
    histogram: number[];
    histogramBinMs: number;
}

export const HISTOGRAM_BINS = 10;

/** Summarises grade events. Early/late notes count as hits but add half an error to their measure. */
export function computeStats(events: readonly GradeEvent[], toleranceMs: number, labelOf: (measureIndex: number) => string): SessionStats {
    let good = 0;
    let early = 0;
    let late = 0;
    let missed = 0;
    let extra = 0;
    const offsets: number[] = [];
    const errors = new Map<number, number>();
    const addError = (measureIndex: number, amount: number) => errors.set(measureIndex, (errors.get(measureIndex) ?? 0) + amount);

    for (const event of events) {
        if (event.kind === "hit") {
            offsets.push(event.offsetMs);
            if (event.grade === "good") good++;
            else {
                if (event.grade === "early") early++;
                else late++;
                addError(event.expected.measureIndex, 0.5);
            }
        } else if (event.kind === "missed") {
            missed++;
            addError(event.expected.measureIndex, 1);
        } else {
            extra++;
            addError(event.measureIndex, 1);
        }
    }

    const expected = good + early + late + missed;
    const denominator = expected + extra;
    const accuracy = denominator === 0 ? 0 : ((good + early + late) / denominator) * 100;
    const mean = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null;
    const spread = mean === null ? null : Math.sqrt(offsets.reduce((sum, o) => sum + (o - mean) ** 2, 0) / offsets.length);

    const binMs = (2 * toleranceMs) / HISTOGRAM_BINS;
    const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);
    for (const offset of offsets) {
        const bin = Math.min(HISTOGRAM_BINS - 1, Math.max(0, Math.floor((offset + toleranceMs) / binMs)));
        histogram[bin]++;
    }

    const worstMeasures = [...errors.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 5)
        .map(([measureIndex, count]) => ({ measureIndex, label: labelOf(measureIndex), errors: Math.round(count * 10) / 10 }));

    return {
        expected,
        good,
        early,
        late,
        missed,
        extra,
        wrong: 0,
        accuracy: Math.round(accuracy * 10) / 10,
        offsetMeanMs: mean === null ? null : Math.round(mean * 10) / 10,
        offsetSpreadMs: spread === null ? null : Math.round(spread * 10) / 10,
        worstMeasures,
        histogram,
        histogramBinMs: binMs,
    };
}
