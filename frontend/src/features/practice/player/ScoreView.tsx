import * as React from "react";
import { Alert, Box } from "@mui/material";
import { OsmdScore } from "../osmd/OsmdScore.ts";
import type { StaffKey } from "../engine/types.ts";

interface ScoreViewProps {
    xml: string;
    staffKeys: StaffKey[];
    zoom: number;
    onReady: (score: OsmdScore | null) => void;
    onMeasureClick?: (measureIndex: number, event: React.MouseEvent) => void;
}

/** Renders the score with OSMD and hands the adapter to the parent. */
export function ScoreView({ xml, staffKeys, zoom, onReady, onMeasureClick }: ScoreViewProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scoreRef = React.useRef<OsmdScore | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const onReadyRef = React.useRef(onReady);
    const zoomRef = React.useRef(zoom);
    const staffKeysRef = React.useRef(staffKeys);

    React.useEffect(() => {
        onReadyRef.current = onReady;
        zoomRef.current = zoom;
        staffKeysRef.current = staffKeys;
    });

    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const score = new OsmdScore(container);
        let cancelled = false;
        score.setZoom(zoomRef.current);
        score
            .load(xml, staffKeysRef.current)
            .then(() => {
                if (cancelled) return;
                scoreRef.current = score;
                setError(null);
                onReadyRef.current(score);
                if (import.meta.env.DEV) (window as unknown as { __osmdScore?: OsmdScore }).__osmdScore = score;
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "The score couldn't be drawn.");
            });
        return () => {
            cancelled = true;
            scoreRef.current = null;
            onReadyRef.current(null);
            score.dispose();
        };
    }, [xml]);

    React.useEffect(() => {
        scoreRef.current?.setZoom(zoom);
    }, [zoom]);

    // Re-layout when the available width changes.
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container || typeof ResizeObserver === "undefined") return;
        let width = container.clientWidth;
        let timer: number | undefined;
        const observer = new ResizeObserver(() => {
            if (Math.abs(container.clientWidth - width) < 8) return;
            width = container.clientWidth;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => scoreRef.current?.render(), 200);
        });
        observer.observe(container);
        return () => {
            observer.disconnect();
            window.clearTimeout(timer);
        };
    }, []);

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>The score couldn't be drawn: {error}</Alert>}
            <Box
                ref={containerRef}
                data-testid="score-view"
                onClick={(event) => {
                    const measure = scoreRef.current?.measureAt(event.clientX, event.clientY);
                    if (measure !== null && measure !== undefined) onMeasureClick?.(measure, event);
                }}
                sx={{ width: "100%", minHeight: 200, "& svg": { display: "block" } }}
            />
        </Box>
    );
}
