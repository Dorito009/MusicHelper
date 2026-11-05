import { Box, Button, FormControlLabel, LinearProgress, Stack, Switch, TextField, Typography } from "@mui/material";
import type { TempoTrainerState } from "../engine/scoreConfig.ts";
import { trainerProgress } from "../engine/tempoTrainer.ts";

/** Start BPM, target BPM, step and the accuracy needed to step up. */
export function TempoTrainerPanel({ state, onChange, onEnable, onReset }: {
    state: TempoTrainerState | null;
    onChange: (state: TempoTrainerState) => void;
    onEnable: (enabled: boolean) => void;
    onReset: () => void;
}) {
    const enabled = state?.enabled ?? false;
    const field = (label: string, key: keyof Omit<TempoTrainerState, "enabled">, unit: string, min: number, max: number) => (
        <TextField
            size="small"
            type="number"
            label={`${label} (${unit})`}
            value={state?.[key] ?? ""}
            disabled={!enabled}
            onChange={(e) => {
                if (!state) return;
                const value = Math.min(max, Math.max(min, Number(e.target.value) || min));
                onChange({ ...state, [key]: value });
            }}
            slotProps={{ htmlInput: { min, max } }}
            fullWidth
        />
    );

    return (
        <Stack spacing={1.5}>
            <FormControlLabel control={<Switch checked={enabled} onChange={(_, on) => onEnable(on)} />} label="Step up the tempo as I improve" />
            {state && (
                <>
                    <Stack direction="row" spacing={1}>
                        {field("Start", "startBpm", "BPM", 10, 400)}
                        {field("Target", "targetBpm", "BPM", 10, 400)}
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        {field("Step", "stepBpm", "BPM", 1, 40)}
                        {field("Needed", "threshold", "%", 50, 100)}
                    </Stack>
                    {enabled && (
                        <Box data-testid="trainer-progress">
                            <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
                                <Typography variant="body2">Now {state.currentBpm} BPM</Typography>
                                <Typography variant="body2" color="text.secondary">Target {state.targetBpm} BPM</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={trainerProgress(state) * 100} />
                            <Typography variant="caption" color="text.secondary">
                                {state.currentBpm >= state.targetBpm
                                    ? "Target reached."
                                    : `Each play-along run or loop pass with at least ${state.threshold} % accuracy adds ${state.stepBpm} BPM.`}
                            </Typography>
                        </Box>
                    )}
                    {enabled && (
                        <Button size="small" variant="outlined" onClick={onReset}>Go back to the start tempo</Button>
                    )}
                </>
            )}
        </Stack>
    );
}
