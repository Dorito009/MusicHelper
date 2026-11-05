import { describe, expect, it } from "vitest";
import { advanceTempoTrainer, newTrainerState, trainerProgress } from "./tempoTrainer.ts";

describe("tempo trainer", () => {
    const state = { enabled: true, startBpm: 80, targetBpm: 100, stepBpm: 8, threshold: 90, currentBpm: 80 };

    it("steps up when the accuracy reaches the threshold, and not below it", () => {
        expect(advanceTempoTrainer(state, 89.9)).toMatchObject({ steppedUp: false, state: { currentBpm: 80 } });
        expect(advanceTempoTrainer(state, 90)).toMatchObject({ steppedUp: true, state: { currentBpm: 88 } });
    });

    it("stops at the target", () => {
        const near = { ...state, currentBpm: 96 };
        expect(advanceTempoTrainer(near, 100)).toMatchObject({ steppedUp: true, reachedTarget: true, state: { currentBpm: 100 } });
        expect(advanceTempoTrainer({ ...state, currentBpm: 100 }, 100)).toMatchObject({ steppedUp: false, reachedTarget: true });
    });

    it("does nothing when disabled", () => {
        expect(advanceTempoTrainer({ ...state, enabled: false }, 100).steppedUp).toBe(false);
    });

    it("reports progress and sensible defaults", () => {
        expect(trainerProgress({ ...state, currentBpm: 90 })).toBe(0.5);
        expect(newTrainerState(120, { stepBpm: 5, threshold: 90 })).toEqual({ enabled: true, startBpm: 84, targetBpm: 120, stepBpm: 5, threshold: 90, currentBpm: 84 });
    });
});
