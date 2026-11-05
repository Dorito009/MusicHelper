import * as React from "react";
import {
    Box,
    Button,
    Chip,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ReplayIcon from "@mui/icons-material/Replay";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import TuneIcon from "@mui/icons-material/Tune";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import type { SessionMode } from "../storage/db.ts";
import type { ControllerSnapshot } from "../session/controller.ts";
import { midiNoteName } from "../ui/noteNames.ts";
import { clampBpm } from "./playerUtils.ts";

export interface TransportProps {
    snapshot: ControllerSnapshot;
    mode: SessionMode;
    onModeChange: (mode: SessionMode) => void;
    bpm: number;
    baseTempo: number;
    onBpmChange: (bpm: number) => void;
    countInBars: number;
    onCountInChange: (bars: 0 | 1 | 2) => void;
    metronomeOn: boolean;
    onMetronomeChange: (on: boolean) => void;
    rhythmOnly: boolean;
    onRhythmOnlyChange: (on: boolean) => void;
    onStart: () => void;
    onStop: () => void;
    onRestart: () => void;
    onPanic: () => void;
    onOpenPanel?: () => void;
    loopLabel: string | null;
}

export function Transport(props: TransportProps) {
    const { snapshot, mode, bpm, baseTempo } = props;
    const running = snapshot.status === "playing" || snapshot.status === "waiting" || snapshot.status === "countIn";
    const percent = Math.round((bpm / baseTempo) * 100);

    return (
        <Paper
            elevation={4}
            sx={{ position: "sticky", top: 0, zIndex: 5, px: { xs: 1, sm: 2 }, py: 1, borderRadius: { xs: 0, sm: 1 } }}
            data-testid="transport"
        >
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <Button
                    variant="contained"
                    color={running ? "warning" : "primary"}
                    startIcon={running ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={running ? props.onStop : props.onStart}
                    sx={{ minWidth: 104 }}
                    aria-keyshortcuts="Space"
                >
                    {running ? "Stop" : "Start"}
                </Button>
                <Tooltip title={props.loopLabel ? `Restart from measure ${props.loopLabel} (R)` : "Restart from the beginning (R)"}>
                    <IconButton onClick={props.onRestart} aria-label="Restart from loop start" aria-keyshortcuts="R">
                        <ReplayIcon />
                    </IconButton>
                </Tooltip>

                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={mode}
                    onChange={(_, value: SessionMode | null) => value && props.onModeChange(value)}
                    aria-label="Practice mode"
                >
                    <ToggleButton value="wait">Wait for me</ToggleButton>
                    <ToggleButton value="play">Play along</ToggleButton>
                </ToggleButtonGroup>

                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <IconButton size="small" aria-label="Slower" aria-keyshortcuts="-" onClick={() => props.onBpmChange(clampBpm(bpm - 2))}>
                        <RemoveIcon fontSize="small" />
                    </IconButton>
                    <NumberField
                        label="Tempo"
                        value={Math.round(bpm)}
                        unit="BPM"
                        width={104}
                        onCommit={(value) => props.onBpmChange(clampBpm(value))}
                    />
                    <NumberField
                        label="Speed"
                        value={percent}
                        unit="%"
                        width={84}
                        onCommit={(value) => props.onBpmChange(clampBpm((baseTempo * value) / 100))}
                    />
                    <IconButton size="small" aria-label="Faster" aria-keyshortcuts="+" onClick={() => props.onBpmChange(clampBpm(bpm + 2))}>
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Stack>

                {mode === "play" && (
                    <>
                        <FormControl size="small" sx={{ minWidth: 112 }}>
                            <InputLabel id="count-in-label">Count-in</InputLabel>
                            <Select
                                labelId="count-in-label"
                                label="Count-in"
                                value={props.countInBars}
                                onChange={(e) => props.onCountInChange(Number(e.target.value) as 0 | 1 | 2)}
                            >
                                <MenuItem value={0}>None</MenuItem>
                                <MenuItem value={1}>1 bar</MenuItem>
                                <MenuItem value={2}>2 bars</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={<Switch checked={props.metronomeOn} onChange={(_, on) => props.onMetronomeChange(on)} />}
                            label="Metronome (M)"
                        />
                        <FormControlLabel
                            control={<Switch checked={props.rhythmOnly} onChange={(_, on) => props.onRhythmOnlyChange(on)} />}
                            label="Rhythm only"
                        />
                    </>
                )}

                <Box sx={{ flexGrow: 1 }} />

                <StatusChip snapshot={snapshot} mode={mode} />

                <Tooltip title="Send All Notes Off on every channel (Esc)">
                    <Button color="error" variant="outlined" size="small" startIcon={<NotificationsOffIcon />} onClick={props.onPanic} aria-keyshortcuts="Escape">
                        Panic
                    </Button>
                </Tooltip>
                {props.onOpenPanel && (
                    <Tooltip title="Staves, loop, tempo trainer and history">
                        <IconButton onClick={props.onOpenPanel} aria-label="Open practice options" sx={{ display: { lg: "none" } }}>
                            <TuneIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Stack>
        </Paper>
    );
}

function StatusChip({ snapshot, mode }: { snapshot: ControllerSnapshot; mode: SessionMode }) {
    if (snapshot.status === "waiting") {
        const remaining = snapshot.expectedPitches.filter((p) => !snapshot.pressedPitches.includes(p));
        return (
            <Chip
                color="info"
                variant="outlined"
                data-testid="waiting-chip"
                label={`Play: ${remaining.map(midiNoteName).join(" ")}`}
            />
        );
    }
    if (snapshot.status === "countIn") return <Chip color="info" label="Count-in…" />;
    if (snapshot.status === "playing") {
        const c = snapshot.counts;
        return (
            <Typography variant="body2" color="text.secondary" data-testid="live-counts">
                {mode === "play" ? `${c.good} good · ${c.timing} early/late · ${c.missed} missed · ${c.extra} extra` : "Playing…"}
            </Typography>
        );
    }
    return null;
}

function NumberField({ label, value, unit, width, onCommit }: { label: string; value: number; unit: string; width: number; onCommit: (value: number) => void }) {
    const [text, setText] = React.useState(String(value));
    const [focused, setFocused] = React.useState(false);
    const shown = focused ? text : String(value);

    const commit = () => {
        const parsed = Number(text);
        if (Number.isFinite(parsed) && parsed > 0) onCommit(parsed);
        setFocused(false);
    };

    return (
        <TextField
            size="small"
            label={label}
            value={shown}
            onFocus={() => {
                setText(String(value));
                setFocused(true);
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            sx={{ width }}
            slotProps={{
                htmlInput: { inputMode: "numeric", "aria-label": `${label} in ${unit}` },
                input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
            }}
        />
    );
}
