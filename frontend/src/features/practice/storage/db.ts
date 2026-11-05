import Dexie, { type EntityTable } from "dexie";
import type { LoopRange, ScoreConfig } from "../engine/scoreConfig.ts";
import type { SessionStats } from "../engine/stats.ts";

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

export type { SessionStats, WorstMeasure } from "../engine/stats.ts";

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
