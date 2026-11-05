import * as React from "react";
import {
    Box,
    Button,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Slider,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import { usePracticeSettings, type PracticeSettings } from "./store.ts";
import { useSelectedDevices } from "../ui/useMidi.ts";
import { usePracticeIo } from "../ui/usePracticeIo.ts";
import { MidiBanner } from "../ui/MidiBanner.tsx";
import { MidiDeviceSelect } from "../ui/MidiDeviceSelect.tsx";
import { midiNoteName } from "../ui/noteNames.ts";
import { CalibrationDialog } from "./CalibrationDialog.tsx";

const CHANNELS = Array.from({ length: 16 }, (_, i) => i + 1);

export function SettingsPage() {
    const settings = usePracticeSettings();
    const { update, reset } = settings;
    const devices = useSelectedDevices();
    const io = usePracticeIo(devices);
    const [calibrating, setCalibrating] = React.useState(false);
    const [confirmReset, setConfirmReset] = React.useState(false);
    const { midi, playback, grading, latency, trainer, display, input } = settings;
    const midiReady = devices.midi.status === "ready" && devices.outputConnected;

    const sendTestNote = () => {
        if (!io) return;
        const now = io.clock.now();
        const channel = midi.firstAccompanimentChannel;
        io.out.noteOn(channel, 60, 100, now);
        io.out.noteOff(channel, 60, now + 600);
    };

    const playClick = () => {
        if (!io) return;
        const start = io.clock.now() + 50;
        for (let i = 0; i < 4; i++) {
            const time = start + i * 500;
            const note = i === 0 ? midi.metronomeDownbeatNote : midi.metronomeBeatNote;
            io.out.noteOn(midi.metronomeChannel, note, midi.metronomeVelocity, time);
            io.out.noteOff(midi.metronomeChannel, note, time + 50);
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            <Typography variant="h4" component="h1">Practice settings</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                These settings apply to the practice pages only. Per-score settings (who plays each staff, channels, loop, tempo) are saved with each score.
            </Typography>

            <Stack spacing={3}>
                <Card title="MIDI">
                    <MidiBanner devices={devices} />
                    <MidiDeviceSelect devices={devices} direction="row" />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                        <FormControlLabel
                            control={<Switch checked={midi.thruEnabled} onChange={(_, on) => update("midi", { thruEnabled: on })} />}
                            label="Send my playing to the output (MIDI thru)"
                        />
                        <ChannelSelect label="My playing channel" value={midi.thruChannel} onChange={(thruChannel) => update("midi", { thruChannel })} disabled={!midi.thruEnabled} />
                    </Stack>
                    <ChannelSelect
                        label="First channel for 'App plays' staves"
                        helper="New scores put the staves the app plays on this channel and the ones after it (skipping the thru and click channels)."
                        value={midi.firstAccompanimentChannel}
                        onChange={(firstAccompanimentChannel) => update("midi", { firstAccompanimentChannel })}
                    />
                    <Typography variant="subtitle2">Metronome click</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <ChannelSelect label="Click channel" value={midi.metronomeChannel} onChange={(metronomeChannel) => update("midi", { metronomeChannel })} />
                        <NoteField label="Downbeat note" value={midi.metronomeDownbeatNote} onChange={(metronomeDownbeatNote) => update("midi", { metronomeDownbeatNote })} />
                        <NoteField label="Beat note" value={midi.metronomeBeatNote} onChange={(metronomeBeatNote) => update("midi", { metronomeBeatNote })} />
                        <NumberSetting label="Click velocity" value={midi.metronomeVelocity} min={1} max={127} onChange={(metronomeVelocity) => update("midi", { metronomeVelocity })} />
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="outlined" onClick={sendTestNote} disabled={!midiReady}>
                            Send a test note (middle C, channel {midi.firstAccompanimentChannel})
                        </Button>
                        <Button variant="outlined" onClick={playClick} disabled={!midiReady}>Play the click</Button>
                        <Button variant="outlined" color="error" onClick={() => io?.panic()}>Panic (All Notes Off)</Button>
                    </Stack>
                </Card>

                <Card title="Playback">
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <FormControl size="small" fullWidth>
                            <InputLabel id="default-mode">Default mode</InputLabel>
                            <Select labelId="default-mode" label="Default mode" value={playback.defaultMode} onChange={(e) => update("playback", { defaultMode: e.target.value as PracticeSettings["playback"]["defaultMode"] })}>
                                <MenuItem value="wait">Wait for me</MenuItem>
                                <MenuItem value="play">Play along</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" fullWidth>
                            <InputLabel id="default-count-in">Count-in</InputLabel>
                            <Select labelId="default-count-in" label="Count-in" value={playback.countInBars} onChange={(e) => update("playback", { countInBars: Number(e.target.value) as 0 | 1 | 2 })}>
                                <MenuItem value={0}>None</MenuItem>
                                <MenuItem value={1}>1 bar</MenuItem>
                                <MenuItem value={2}>2 bars</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                    <FormControlLabel
                        control={<Switch checked={playback.metronomeOn} onChange={(_, on) => update("playback", { metronomeOn: on })} />}
                        label="Metronome on when a score opens (play along)"
                    />
                </Card>

                <Card title="Grading">
                    <Box>
                        <Typography gutterBottom>Timing tolerance: ±{grading.toleranceMs} ms</Typography>
                        <Slider
                            value={grading.toleranceMs}
                            min={40}
                            max={300}
                            step={10}
                            marks={[{ value: 100, label: "100 ms" }]}
                            onChange={(_, value) => update("grading", { toleranceMs: value as number })}
                            aria-label="Timing tolerance in milliseconds"
                        />
                        <Typography variant="body2" color="text.secondary">
                            Within half the tolerance counts as good; within the tolerance as early or late.
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={grading.rhythmOnly} onChange={(_, on) => update("grading", { rhythmOnly: on })} />}
                        label="Rhythm only when a score opens (any key counts)"
                    />
                </Card>

                <Card title="Latency">
                    <Typography variant="body2" color="text.secondary">
                        The time between a note being sent and you hearing and playing along with it. It is subtracted from your
                        input timestamps before grading. Calibrate it with your sampler running, so the click goes through the same path as the music.
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                        <NumberSetting label="Latency offset (ms)" value={latency.offsetMs} min={-500} max={500} onChange={(offsetMs) => update("latency", { offsetMs })} />
                        <Button variant="contained" onClick={() => setCalibrating(true)}>Calibrate latency</Button>
                    </Stack>
                    {latency.lastCalibration && (
                        <Typography variant="body2" color="text.secondary">
                            Last calibration: {latency.lastCalibration.medianMs} ms, spread ±{latency.lastCalibration.spreadMs} ms
                            ({latency.lastCalibration.taps} taps) on {new Date(latency.lastCalibration.at).toLocaleDateString()}.
                        </Typography>
                    )}
                </Card>

                <Card title="Tempo trainer defaults">
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <NumberSetting label="Step (BPM)" value={trainer.stepBpm} min={1} max={40} onChange={(stepBpm) => update("trainer", { stepBpm })} />
                        <NumberSetting label="Accuracy needed (%)" value={trainer.threshold} min={50} max={100} onChange={(threshold) => update("trainer", { threshold })} />
                    </Stack>
                </Card>

                <Card title="Display">
                    <Box>
                        <Typography gutterBottom>Score zoom: {Math.round(display.zoom * 100)} %</Typography>
                        <Slider value={display.zoom} min={0.4} max={2.5} step={0.1} onChange={(_, value) => update("display", { zoom: value as number })} aria-label="Score zoom" />
                    </Box>
                    <FormControlLabel control={<Switch checked={display.followCursor} onChange={(_, on) => update("display", { followCursor: on })} />} label="Scroll to follow the cursor" />
                    <FormControlLabel control={<Switch checked={display.showPiano} onChange={(_, on) => update("display", { showPiano: on })} />} label="Show the on-screen piano" />
                </Card>

                <Card title="Computer keyboard input">
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        <FormControl size="small" fullWidth>
                            <InputLabel id="keyboard-input">Play notes with the computer keyboard</InputLabel>
                            <Select labelId="keyboard-input" label="Play notes with the computer keyboard" value={input.computerKeyboard} onChange={(e) => update("input", { computerKeyboard: e.target.value as PracticeSettings["input"]["computerKeyboard"] })}>
                                <MenuItem value="auto">Automatic (on when no MIDI input is connected)</MenuItem>
                                <MenuItem value="on">On</MenuItem>
                                <MenuItem value="off">Off</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id="keyboard-octave">Octave of the A key</InputLabel>
                            <Select labelId="keyboard-octave" label="Octave of the A key" value={input.keyboardOctave} onChange={(e) => update("input", { keyboardOctave: Number(e.target.value) })}>
                                {Array.from({ length: 9 }, (_, i) => i).map((octave) => (
                                    <MenuItem key={octave} value={octave}>C{octave}{octave === 4 ? " (middle C)" : ""}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                        A W S E D F T G Y H U J K play one octave (white keys on the A row, black keys above). Z and X change the octave.
                    </Typography>
                </Card>

                <Box>
                    <Button color="error" variant="outlined" onClick={() => setConfirmReset(true)}>Reset all practice settings</Button>
                </Box>
            </Stack>

            {io && <CalibrationDialog open={calibrating} onClose={() => setCalibrating(false)} io={io} devices={devices} />}

            <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
                <DialogTitle>Reset all practice settings?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Devices, channels, latency and every other practice setting go back to their defaults. Your scores and history are kept.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={() => { reset(); setConfirmReset(false); }}>Reset settings</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }} component="section" aria-label={title}>
            <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
            <Stack spacing={2}>{children}</Stack>
        </Paper>
    );
}

function ChannelSelect({ label, value, onChange, disabled, helper }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; helper?: string }) {
    const id = React.useId();
    return (
        <Box sx={{ minWidth: 180 }}>
            <FormControl size="small" fullWidth disabled={disabled}>
                <InputLabel id={id}>{label}</InputLabel>
                <Select labelId={id} label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
                    {CHANNELS.map((ch) => <MenuItem key={ch} value={ch}>Channel {ch}</MenuItem>)}
                </Select>
            </FormControl>
            {helper && <Typography variant="caption" color="text.secondary">{helper}</Typography>}
        </Box>
    );
}

function NumberSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
    const [text, setText] = React.useState<string | null>(null);
    return (
        <TextField
            size="small"
            type="number"
            label={label}
            value={text ?? String(value)}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
                const parsed = Number(text);
                if (text !== null && text.trim() !== "" && Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, Math.round(parsed))));
                setText(null);
            }}
            slotProps={{ htmlInput: { min, max } }}
            sx={{ minWidth: 150 }}
        />
    );
}

function NoteField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
    return (
        <Stack spacing={0.5}>
            <NumberSetting label={label} value={value} min={0} max={127} onChange={onChange} />
            <Typography variant="caption" color="text.secondary">MIDI {value} = {midiNoteName(value)}</Typography>
        </Stack>
    );
}
