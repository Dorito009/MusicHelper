import * as React from "react";
import { Alert, Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { parseMusicXml } from "../engine/musicxml.ts";
import { buildTimeline } from "../engine/timeline.ts";
import type { ScoreConfig } from "../engine/scoreConfig.ts";
import type { OsmdScore } from "../osmd/OsmdScore.ts";
import { ScoreView } from "./ScoreView.tsx";
import { usePracticeSettings } from "../settings/store.ts";
import { useSelectedDevices } from "../ui/useMidi.ts";
import { MidiBanner } from "../ui/MidiBanner.tsx";

export interface PracticePlayerProps {
    scoreId: string;
    title: string;
    xml: string;
    config: ScoreConfig;
    onConfigChange: (config: ScoreConfig) => void;
}

export function PracticePlayer({ xml, title }: PracticePlayerProps) {
    const parsed = React.useMemo(() => {
        try {
            return { score: parseMusicXml(xml), error: null };
        } catch (error) {
            return { score: null, error: error instanceof Error ? error.message : String(error) };
        }
    }, [xml]);
    const timeline = React.useMemo(() => (parsed.score ? buildTimeline(parsed.score) : null), [parsed.score]);
    const zoom = usePracticeSettings((s) => s.display.zoom);
    const updateSettings = usePracticeSettings((s) => s.update);
    const [osmd, setOsmd] = React.useState<OsmdScore | null>(null);
    const devices = useSelectedDevices();

    React.useEffect(() => {
        if (!osmd || !timeline) return;
        const first = timeline.notes[0];
        if (first) osmd.moveCursor(first.measureIndex, first.onsetInMeasure);
    }, [osmd, timeline]);

    if (!parsed.score || !timeline) {
        return <Alert severity="error">This score can't be read: {parsed.error}</Alert>;
    }

    const staffKeys = parsed.score.staves.map((s) => s.key);

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>{title}</Typography>
                <Tooltip title="Zoom out">
                    <IconButton aria-label="Zoom out" onClick={() => updateSettings("display", { zoom: Math.max(0.4, round(zoom - 0.1)) })}>
                        <ZoomOutIcon />
                    </IconButton>
                </Tooltip>
                <Typography variant="body2" sx={{ minWidth: 48, textAlign: "center" }}>{Math.round(zoom * 100)} %</Typography>
                <Tooltip title="Zoom in">
                    <IconButton aria-label="Zoom in" onClick={() => updateSettings("display", { zoom: Math.min(2.5, round(zoom + 0.1)) })}>
                        <ZoomInIcon />
                    </IconButton>
                </Tooltip>
            </Stack>
            <MidiBanner devices={devices} />
            {parsed.score.notices.map((notice) => (
                <Alert key={notice} severity="info">{notice}</Alert>
            ))}
            <Paper variant="outlined" sx={{ p: { xs: 0.5, sm: 2 }, overflow: "hidden" }}>
                <Box>
                    <ScoreView
                        xml={xml}
                        staffKeys={staffKeys}
                        zoom={zoom}
                        onReady={setOsmd}
                        onMeasureClick={(measureIndex) => osmd?.moveCursor(measureIndex, 0)}
                    />
                </Box>
            </Paper>
        </Stack>
    );
}

function round(value: number) {
    return Math.round(value * 10) / 10;
}
