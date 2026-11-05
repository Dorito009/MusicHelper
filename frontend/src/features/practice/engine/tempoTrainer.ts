import type { TempoTrainerState } from "./scoreConfig.ts";

export interface TrainerStep {
    state: TempoTrainerState;
    steppedUp: boolean;
    reachedTarget: boolean;
}

/** After a loop pass: step the tempo up when the accuracy reached the threshold. */
export function advanceTempoTrainer(state: TempoTrainerState, accuracy: number): TrainerStep {
    if (!state.enabled) return { state, steppedUp: false, reachedTarget: state.currentBpm >= state.targetBpm };
    if (accuracy < state.threshold || state.currentBpm >= state.targetBpm) {
        return { state, steppedUp: false, reachedTarget: state.currentBpm >= state.targetBpm };
    }
    const currentBpm = Math.min(state.targetBpm, state.currentBpm + state.stepBpm);
    return { state: { ...state, currentBpm }, steppedUp: true, reachedTarget: currentBpm >= state.targetBpm };
}

/** 0..1 progress from the start tempo to the target tempo. */
export function trainerProgress(state: TempoTrainerState): number {
    const span = state.targetBpm - state.startBpm;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (state.currentBpm - state.startBpm) / span));
}

export function newTrainerState(scoreTempo: number, defaults: { stepBpm: number; threshold: number }): TempoTrainerState {
    const startBpm = Math.max(20, Math.round(scoreTempo * 0.7));
    return { enabled: true, startBpm, targetBpm: Math.round(scoreTempo), stepBpm: defaults.stepBpm, threshold: defaults.threshold, currentBpm: startBpm };
}
