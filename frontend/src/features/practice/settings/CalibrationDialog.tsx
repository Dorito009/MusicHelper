import * as React from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Typography } from "@mui/material";
import { CALIBRATION_BPM, CALIBRATION_CLICKS, CALIBRATION_IGNORED_TAPS, CalibrationRun, type CalibrationState } from "../session/calibration.ts";
import type { PracticeIo } from "../session/io.ts";
import { getPracticeSettings, usePracticeSettings } from "./store.ts";
import type { SelectedDevices } from "../ui/useMidi.ts";

/** Plays 16 clicks at 90 BPM through the click channel; I tap any key on each beat. */
export function CalibrationDialog({ open, onClose, io, devices }: { open: boolean; onClose: () => void; io: PracticeIo; devices: SelectedDevices }) {
    const update = usePracticeSettings((s) => s.update);
    const [state, setState] = React.useState<CalibrationState>({ phase: "idle" });
    const [run, setRun] = React.useState<CalibrationRun | null>(null);

    React.useEffect(() => {
        const created = new CalibrationRun(io.clock, io.out, io.input, setState);
        setRun(created);
        return () => created.stop();
    }, [io]);

    const start = () => {
        const { midi } = getPracticeSettings();
        run?.start({ channel: midi.metronomeChannel, downbeatNote: midi.metronomeDownbeatNote, beatNote: midi.metronomeBeatNote, velocity: midi.metronomeVelocity });
    };

    const close = () => {
        run?.stop();
        setState({ phase: "idle" });
        onClose();
    };

    const save = () => {
        if (state.phase !== "done" || !state.result) return;
        update("latency", {
            offsetMs: state.result.medianMs,
            lastCalibration: { medianMs: state.result.medianMs, spreadMs: state.result.spreadMs, taps: state.result.taps, at: Date.now() },
        });
        close();
    };

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
            <DialogTitle>Calibrate latency</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Typography>
                        You'll hear {CALIBRATION_CLICKS} clicks at {CALIBRATION_BPM} BPM through your click channel. Tap any key on your
                        keyboard exactly on each click. The first {CALIBRATION_IGNORED_TAPS} taps are ignored while you settle in.
                    </Typography>
                    {!devices.outputConnected && (
                        <Alert severity="warning">No MIDI output selected, nothing will sound. Choose your sampler's port first.</Alert>
                    )}
                    {state.phase === "running" && (
                        <>
                            <LinearProgress variant="determinate" value={(state.clicksPlayed / CALIBRATION_CLICKS) * 100} />
                            <Typography>Click {state.clicksPlayed} of {CALIBRATION_CLICKS} · {state.taps} taps</Typography>
                        </>
                    )}
                    {state.phase === "done" && state.result && (
                        <Alert severity="success" data-testid="calibration-result">
                            Your taps arrive {Math.abs(state.result.medianMs)} ms {state.result.medianMs >= 0 ? "after" : "before"} the click
                            (median of {state.result.taps} taps, spread ±{state.result.spreadMs} ms).
                            {state.result.spreadMs > 30 && " The spread is large; try again for a steadier result."}
                        </Alert>
                    )}
                    {state.phase === "done" && !state.result && (
                        <Alert severity="error">Not enough taps on the beat to measure. Try again and tap on every click.</Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close}>Cancel</Button>
                <Button onClick={start} disabled={state.phase === "running"}>
                    {state.phase === "done" ? "Try again" : "Start the clicks"}
                </Button>
                <Button variant="contained" onClick={save} disabled={state.phase !== "done" || !state.result}>
                    Save {state.phase === "done" && state.result ? `${state.result.medianMs} ms` : ""} as latency offset
                </Button>
            </DialogActions>
        </Dialog>
    );
}
