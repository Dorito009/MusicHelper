import * as React from "react";
import {
    Alert,
    Box,
    Divider,
    Drawer,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import CloseIcon from "@mui/icons-material/Close";
import { parseMusicXml } from "../engine/musicxml.ts";
import { buildTimeline } from "../engine/timeline.ts";
import { completeScoreConfig, type ScoreConfig } from "../engine/scoreConfig.ts";
import type { OsmdScore } from "../osmd/OsmdScore.ts";
import { ScoreView } from "./ScoreView.tsx";
import { channelDefaultsFromSettings, getPracticeSettings, usePracticeSettings } from "../settings/store.ts";
import { useSelectedDevices } from "../ui/useMidi.ts";
import { MidiBanner } from "../ui/MidiBanner.tsx";
import { MidiDeviceSelect } from "../ui/MidiDeviceSelect.tsx";
import { usePracticeIo } from "../ui/usePracticeIo.ts";
import { PracticeController, type ControllerSnapshot, type RunResult } from "../session/controller.ts";
import { WorkerTicker } from "../midi/ticker.ts";
import { saveSession } from "../storage/scores.ts";
import type { SessionMode } from "../storage/db.ts";
import { Transport } from "./Transport.tsx";
import { clampBpm } from "./playerUtils.ts";
import { StaffRolesPanel } from "./StaffRolesPanel.tsx";
import { ResultsPanel } from "./ResultsPanel.tsx";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { measureLabel } from "../session/results.ts";

export interface PracticePlayerProps {
    scoreId: string;
    title: string;
    xml: string;
    config: ScoreConfig;
    onConfigChange: (config: ScoreConfig) => void;
    /** Extra controls above the score (used by the sight-reading page). */
    toolbar?: React.ReactNode;
}

const IDLE_SNAPSHOT: ControllerSnapshot = {
    status: "idle",
    mode: "wait",
    expectedPitches: [],
    pressedPitches: [],
    heldKeys: [],
    keyFeedback: {},
    counts: { correct: 0, wrong: 0, good: 0, timing: 0, missed: 0, extra: 0 },
    currentMeasure: null,
    iteration: 0,
    lastResult: null,
};

const noopSubscribe = () => () => {};

export function PracticePlayer(props: PracticePlayerProps) {
    const { xml, title, scoreId, onConfigChange } = props;
    const parsed = React.useMemo(() => {
        try {
            return { score: parseMusicXml(xml), error: null };
        } catch (error) {
            return { score: null, error: error instanceof Error ? error.message : String(error) };
        }
    }, [xml]);
    const score = parsed.score;
    const timeline = React.useMemo(() => (score ? buildTimeline(score) : null), [score]);

    const settings = usePracticeSettings();
    const config = React.useMemo(
        () => (score ? completeScoreConfig(props.config, score, channelDefaultsFromSettings(getPracticeSettings())) : props.config),
        [props.config, score],
    );

    const devices = useSelectedDevices();
    const io = usePracticeIo(devices);
    const [osmd, setOsmd] = React.useState<OsmdScore | null>(null);
    const [panelOpen, setPanelOpen] = React.useState(false);
    const [result, setResult] = React.useState<RunResult | null>(null);

    const [mode, setMode] = React.useState<SessionMode>(settings.playback.defaultMode);
    const [countInBars, setCountInBars] = React.useState<0 | 1 | 2>(settings.playback.countInBars);
    const [metronomeOn, setMetronomeOn] = React.useState(settings.playback.metronomeOn);
    const [rhythmOnly, setRhythmOnly] = React.useState(settings.grading.rhythmOnly);
    const baseTempo = timeline?.baseTempo ?? 120;
    const [bpm, setBpmState] = React.useState(() => clampBpm(props.config.lastBpm ?? baseTempo));

    // Latest values for callbacks that outlive a render.
    const latest = React.useRef({ metronomeOn, config, scoreId, title, onConfigChange });
    React.useEffect(() => {
        latest.current = { metronomeOn, config, scoreId, title, onConfigChange };
    });

    const [controller, setController] = React.useState<PracticeController | null>(null);
    const followRef = React.useRef<(measureIndex: number) => void>(() => {});

    React.useEffect(() => {
        if (!io) return;
        const created = new PracticeController({
            clock: io.clock,
            out: io.out,
            input: io.input,
            ticker: new WorkerTicker(),
            getMetronome: () => {
                const { midi } = getPracticeSettings();
                return {
                    enabled: latest.current.metronomeOn,
                    channel: midi.metronomeChannel,
                    downbeatNote: midi.metronomeDownbeatNote,
                    beatNote: midi.metronomeBeatNote,
                    velocity: midi.metronomeVelocity,
                };
            },
            getPanicChannels: () => {
                const channels = new Set(io.panicChannels());
                for (const staff of Object.values(latest.current.config.staves)) if (staff.role === "app") channels.add(staff.channel);
                return [...channels];
            },
            onResult: (run) => {
                setResult(run);
                void saveSession({
                    scoreId: latest.current.scoreId,
                    scoreTitle: latest.current.title,
                    startedAt: run.startedAt,
                    durationMs: run.durationMs,
                    mode: run.mode,
                    bpm: run.bpm,
                    measureRange: run.measureRange,
                    rhythmOnly: run.rhythmOnly,
                    stats: run.stats,
                });
            },
            onCursor: (measureIndex) => followRef.current(measureIndex),
        });
        setController(created);
        if (import.meta.env.DEV) (window as unknown as { __practiceController?: PracticeController }).__practiceController = created;
        return () => {
            created.dispose();
            setController(null);
        };
    }, [io]);

    const snapshot = React.useSyncExternalStore(
        controller?.subscribe ?? noopSubscribe,
        controller?.getSnapshot ?? (() => IDLE_SNAPSHOT),
    );

    React.useEffect(() => {
        controller?.setDisplay(osmd);
    }, [controller, osmd]);

    React.useEffect(() => {
        if (controller && score) controller.setScore(score, config);
    }, [controller, score, config]);

    // Show the cursor at the start when idle.
    React.useEffect(() => {
        if (!osmd || !timeline || snapshot.status !== "idle") return;
        const startMeasure = config.loop?.from ?? 0;
        osmd.moveCursor(startMeasure, 0);
        osmd.setLoopRange(config.loop);
    }, [osmd, timeline, snapshot.status, config.loop]);

    React.useEffect(() => {
        followRef.current = (measureIndex: number) => {
            if (!osmd || !getPracticeSettings().display.followCursor) return;
            const box = osmd.measureBox(measureIndex);
            const container = document.querySelector<HTMLElement>("[data-testid=score-view]");
            if (!box || !container) return;
            const rect = container.getBoundingClientRect();
            const top = rect.top + box.y;
            const bottom = top + box.height;
            const margin = 140;
            if (top < margin || bottom > window.innerHeight - 160) {
                window.scrollTo({ top: window.scrollY + top - margin, behavior: "smooth" });
            }
        };
    }, [osmd]);

    const updateConfig = React.useCallback((next: ScoreConfig) => latest.current.onConfigChange(next), []);

    const setBpm = (value: number) => {
        const next = clampBpm(value);
        setBpmState(next);
        controller?.setBpm(next);
        updateConfig({ ...latest.current.config, lastBpm: next });
    };

    const start = () => {
        if (!controller || !score) return;
        setResult(null);
        const s = getPracticeSettings();
        controller.start({
            mode,
            bpm,
            countInBars,
            rhythmOnly: mode === "play" && rhythmOnly,
            loop: config.loop,
            toleranceMs: s.grading.toleranceMs,
            latencyOffsetMs: s.latency.offsetMs,
        });
    };

    const stop = () => controller?.stop();

    const changeMode = (next: SessionMode) => {
        if (next === mode) return;
        controller?.stop(); // a mode change stops the run (and sends panic)
        setMode(next);
    };

    if (!score || !timeline) {
        return <Alert severity="error">This score can't be read: {parsed.error}</Alert>;
    }

    const staffKeys = score.staves.map((s) => s.key);
    const labelOf = (measureIndex: number) => measureLabel(timeline, measureIndex);
    const loopLabel = config.loop ? labelOf(config.loop.from) : null;

    const panel = (
        <Stack spacing={2} divider={<Divider flexItem />}>
            <Section title="Staves">
                <StaffRolesPanel staves={score.staves} config={config} onChange={updateConfig} disabled={controller?.isRunning} />
            </Section>
            <Section title="MIDI devices">
                <MidiDeviceSelect devices={devices} />
            </Section>
            <Section title="History">
                <HistoryPanel scoreId={scoreId} measureLabel={labelOf} />
            </Section>
        </Stack>
    );

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>{title}</Typography>
                <ZoomControls />
            </Stack>
            {props.toolbar}
            <MidiBanner devices={devices} compact />
            {score.notices.map((notice) => (
                <Alert key={notice} severity="info">{notice}</Alert>
            ))}

            <Transport
                snapshot={snapshot}
                mode={mode}
                onModeChange={changeMode}
                bpm={bpm}
                baseTempo={baseTempo}
                onBpmChange={setBpm}
                countInBars={countInBars}
                onCountInChange={setCountInBars}
                metronomeOn={metronomeOn}
                onMetronomeChange={setMetronomeOn}
                rhythmOnly={rhythmOnly}
                onRhythmOnlyChange={setRhythmOnly}
                onStart={start}
                onStop={stop}
                onRestart={start}
                onPanic={() => controller?.panic()}
                onOpenPanel={() => setPanelOpen(true)}
                loopLabel={loopLabel}
            />

            {result && (
                <ResultsPanel
                    result={result}
                    onClose={() => setResult(null)}
                    onLoopMeasure={(measureIndex) => updateConfig({ ...config, loop: { from: measureIndex, to: measureIndex } })}
                />
            )}

            <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
                <Paper variant="outlined" sx={{ p: { xs: 0.5, sm: 2 }, overflow: "hidden", flexGrow: 1, minWidth: 0 }}>
                    <ScoreView xml={xml} staffKeys={staffKeys} zoom={settings.display.zoom} onReady={setOsmd} />
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, width: 340, flexShrink: 0, display: { xs: "none", lg: "block" } }}>
                    {panel}
                </Paper>
            </Stack>

            <Drawer anchor="right" open={panelOpen} onClose={() => setPanelOpen(false)} sx={{ display: { lg: "none" } }}>
                <Box sx={{ width: { xs: "100vw", sm: 380 }, p: 2 }}>
                    <Stack direction="row" sx={{ alignItems: "center", mb: 1 }}>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>Practice options</Typography>
                        <IconButton aria-label="Close practice options" onClick={() => setPanelOpen(false)}><CloseIcon /></IconButton>
                    </Stack>
                    {panel}
                </Box>
            </Drawer>
        </Stack>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography>
            {children}
        </Box>
    );
}

function ZoomControls() {
    const zoom = usePracticeSettings((s) => s.display.zoom);
    const update = usePracticeSettings((s) => s.update);
    const set = (value: number) => update("display", { zoom: Math.min(2.5, Math.max(0.4, Math.round(value * 10) / 10)) });
    return (
        <Stack direction="row" sx={{ alignItems: "center" }}>
            <Tooltip title="Zoom out">
                <IconButton aria-label="Zoom out" onClick={() => set(zoom - 0.1)}><ZoomOutIcon /></IconButton>
            </Tooltip>
            <Typography variant="body2" sx={{ minWidth: 48, textAlign: "center" }}>{Math.round(zoom * 100)} %</Typography>
            <Tooltip title="Zoom in">
                <IconButton aria-label="Zoom in" onClick={() => set(zoom + 0.1)}><ZoomInIcon /></IconButton>
            </Tooltip>
        </Stack>
    );
}
