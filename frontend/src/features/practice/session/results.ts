import type { WaitModeStats } from "../engine/waitMode.ts";
import type { ScoreTimeline } from "../engine/types.ts";
import type { SessionStats, WorstMeasure } from "../storage/db.ts";

/** Measure label as printed, for a written measure index. */
export function measureLabel(timeline: ScoreTimeline, measureIndex: number): string {
    return timeline.measures.find((m) => m.measureIndex === measureIndex)?.number ?? String(measureIndex + 1);
}

export function worstMeasures(errorsByMeasure: Map<number, number>, timeline: ScoreTimeline, limit = 5): WorstMeasure[] {
    return [...errorsByMeasure.entries()]
        .filter(([, errors]) => errors > 0)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, limit)
        .map(([measureIndex, errors]) => ({ measureIndex, label: measureLabel(timeline, measureIndex), errors: round1(errors) }));
}

/** Wait-for-me results: every expected note is eventually played, so accuracy is right / (right + wrong). */
export function waitModeStats(stats: WaitModeStats, timeline: ScoreTimeline): SessionStats {
    const attempts = stats.correct + stats.wrong;
    return {
        expected: stats.expectedNotes,
        good: stats.correct,
        early: 0,
        late: 0,
        missed: Math.max(0, stats.expectedNotes - stats.correct),
        extra: 0,
        wrong: stats.wrong,
        accuracy: attempts === 0 ? 0 : round1((stats.correct / attempts) * 100),
        offsetMeanMs: null,
        offsetSpreadMs: null,
        worstMeasures: worstMeasures(stats.wrongByMeasure, timeline),
        histogram: [],
        histogramBinMs: 0,
    };
}

export function round1(value: number): number {
    return Math.round(value * 10) / 10;
}
