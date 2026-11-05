import { DEFAULT_EXERCISE_OPTIONS, type ExerciseOptions } from "../engine/generator/generate.ts";

export const SIGHT_READING_KEY = "music-helper:practice:sight-reading";

export const RANGE_DEFAULTS: Record<ExerciseOptions["clef"], { lowest: number; highest: number }> = {
    treble: { lowest: 60, highest: 79 },
    bass: { lowest: 40, highest: 60 },
    grand: { lowest: 60, highest: 79 },
};

/** Last used options, from localStorage (falls back to the defaults). */
export function loadExerciseOptions(): ExerciseOptions {
    try {
        const raw = localStorage.getItem(SIGHT_READING_KEY);
        if (!raw) return DEFAULT_EXERCISE_OPTIONS;
        const stored = JSON.parse(raw) as Partial<ExerciseOptions>;
        const merged = { ...DEFAULT_EXERCISE_OPTIONS, ...stored };
        const valid =
            ["treble", "bass", "grand"].includes(merged.clef) &&
            typeof merged.tonic === "string" &&
            typeof merged.scaleType === "string" &&
            Number.isFinite(merged.lowest) &&
            Number.isFinite(merged.highest) &&
            Array.isArray(merged.noteValues) &&
            Number.isFinite(merged.maxLeap) &&
            Number.isFinite(merged.measures) &&
            typeof merged.seed === "string" &&
            merged.timeSignature &&
            Number.isFinite(merged.timeSignature.beats);
        return valid ? merged : DEFAULT_EXERCISE_OPTIONS;
    } catch {
        return DEFAULT_EXERCISE_OPTIONS;
    }
}

export function storeExerciseOptions(options: ExerciseOptions): void {
    try {
        localStorage.setItem(SIGHT_READING_KEY, JSON.stringify(options));
    } catch {
        // Storage may be unavailable (private mode); the options just aren't remembered.
    }
}
