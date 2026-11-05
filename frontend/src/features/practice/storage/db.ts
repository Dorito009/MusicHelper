import Dexie, { type EntityTable } from "dexie";
import type { LoopRange, ScoreConfig } from "../engine/scoreConfig.ts";

export type ScoreSource = "import" | "sight-reading";

export interface ScoreRecord {
    id: string;
    title: string;
    composer: string;
    fileName: string;
    /** Plain MusicXML (.mxl files are unzipped on import). */
    xml: string;
    addedAt: number;
    lastPracticedAt: number | null;
    config: ScoreConfig;
    staffCount: number;
    source: ScoreSource;
    /** Best accuracy % across all sessions, kept up to date when a session is saved. */
    bestAccuracy: number | null;
    /** Generator seed, for sight-reading exercises. */
    seed?: string;
}

export type SessionMode = "wait" | "play";

export interface WorstMeasure {
    /** Written measure index. */
    measureIndex: number;
    /** Measure number as printed. */
    label: string;
    errors: number;
}

export interface SessionStats {
    /** Notes I was expected to play. */
    expected: number;
    good: number;
    early: number;
    late: number;
    missed: number;
    extra: number;
    /** Wrong notes pressed in wait-for-me mode. */
    wrong: number;
    accuracy: number;
    offsetMeanMs: number | null;
    offsetSpreadMs: number | null;
    worstMeasures: WorstMeasure[];
    /** Offset histogram: counts per bin, from -tolerance to +tolerance. */
    histogram: number[];
    histogramBinMs: number;
}

export interface SessionRecord {
    id: string;
    scoreId: string;
    scoreTitle: string;
    startedAt: number;
    durationMs: number;
    mode: SessionMode;
    bpm: number;
    measureRange: LoopRange | null;
    rhythmOnly: boolean;
    stats: SessionStats;
}

export const practiceDb = new Dexie("music-helper-practice") as Dexie & {
    scores: EntityTable<ScoreRecord, "id">;
    sessions: EntityTable<SessionRecord, "id">;
};

practiceDb.version(1).stores({
    scores: "id, addedAt, lastPracticedAt, source",
    sessions: "id, scoreId, startedAt, [scoreId+startedAt]",
});

export function newId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
