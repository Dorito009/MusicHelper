import { Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RepeatIcon from "@mui/icons-material/Repeat";
import type { RunResult } from "../session/controller.ts";
import { describeOffset } from "./playerUtils.ts";

/** Results of the last run: accuracy, counts, timing, histogram and the worst measures. */
export function ResultsPanel({ result, onClose, onLoopMeasure }: {
    result: RunResult;
    onClose: () => void;
    onLoopMeasure: (measureIndex: number) => void;
}) {
    const { stats } = result;
    const isWait = result.mode === "wait";
    return (
        <Paper variant="outlined" sx={{ p: 2 }} data-testid="results-panel">
            <Stack direction="row" sx={{ alignItems: "flex-start" }}>
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="overline" color="text.secondary">
                        {isWait ? "Wait for me" : result.rhythmOnly ? "Play along, rhythm only" : "Play along"} · {Math.round(result.bpm)} BPM
                        {result.iteration > 0 ? ` · loop pass ${result.iteration + 1}` : ""}
                    </Typography>
                    <Typography variant="h4" data-testid="results-accuracy">{Math.round(stats.accuracy)} % accuracy</Typography>
                </Box>
                <Tooltip title="Hide results">
                    <IconButton onClick={onClose} aria-label="Hide results"><CloseIcon /></IconButton>
                </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", my: 1 }}>
                {isWait ? (
                    <>
                        <Chip color="success" label={`${stats.good} right notes`} />
                        <Chip color="error" label={`${stats.wrong} wrong notes`} />
                        <Chip label={`${Math.round(result.durationMs / 1000)} s`} />
                    </>
                ) : (
                    <>
                        <Chip color="success" label={`${stats.good} good`} />
                        <Chip color="warning" label={`${stats.early} early · ${stats.late} late`} />
                        <Chip color="error" label={`${stats.missed} missed`} />
                        <Chip color="error" variant="outlined" label={`${stats.extra} extra`} />
                    </>
                )}
            </Stack>

            {!isWait && stats.offsetMeanMs !== null && (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, my: 1 }}>
                    <Box>
                        <Typography>{describeOffset(stats.offsetMeanMs)}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Average {formatSigned(stats.offsetMeanMs)} ms, spread ±{Math.round(stats.offsetSpreadMs ?? 0)} ms
                        </Typography>
                    </Box>
                    <Histogram bins={stats.histogram} binMs={stats.histogramBinMs} />
                </Stack>
            )}

            {stats.worstMeasures.length > 0 && (
                <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Measures to work on</Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        {stats.worstMeasures.map((m) => (
                            <Button
                                key={m.measureIndex}
                                size="small"
                                variant="outlined"
                                startIcon={<RepeatIcon />}
                                onClick={() => onLoopMeasure(m.measureIndex)}
                            >
                                Loop measure {m.label} ({m.errors} {m.errors === 1 ? "error" : "errors"})
                            </Button>
                        ))}
                    </Stack>
                </Box>
            )}
        </Paper>
    );
}

function formatSigned(value: number): string {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
}

/** Small offset histogram; the middle bar is "on time". */
export function Histogram({ bins, binMs }: { bins: number[]; binMs: number }) {
    if (bins.length === 0) return null;
    const max = Math.max(1, ...bins);
    const half = (bins.length * binMs) / 2;
    return (
        <Box aria-label="Timing offset histogram" role="img">
            <Stack direction="row" spacing="2px" sx={{ alignItems: "flex-end", height: 56 }}>
                {bins.map((count, i) => {
                    const center = -half + (i + 0.5) * binMs;
                    const color = Math.abs(center) <= half / 2 ? "success.main" : "warning.main";
                    return (
                        <Tooltip key={i} title={`${Math.round(center - binMs / 2)} to ${Math.round(center + binMs / 2)} ms: ${count}`}>
                            <Box sx={{ width: 8, height: `${Math.max(2, (count / max) * 56)}px`, bgcolor: count ? color : "action.hover", borderRadius: "2px 2px 0 0" }} />
                        </Tooltip>
                    );
                })}
            </Stack>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography variant="caption" color="text.secondary">early</Typography>
                <Typography variant="caption" color="text.secondary">late</Typography>
            </Stack>
        </Box>
    );
}
