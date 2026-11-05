import * as React from "react";
import { Box } from "@mui/material";
import type { KeyFeedback } from "../session/controller.ts";
import { midiNoteName } from "../ui/noteNames.ts";

const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_WIDTH = 22;

const FEEDBACK_COLORS: Record<KeyFeedback, string> = { good: "#66bb6a", timing: "#ffa726", bad: "#ef5350" };

/** Keys from `low` to `high`: expected notes in blue, held keys pressed down, and right/wrong feedback. */
export function OnScreenPiano({ low, high, expected, held, feedback }: {
    low: number;
    high: number;
    expected: number[];
    held: number[];
    feedback: Record<number, KeyFeedback>;
}) {
    const keys = React.useMemo(() => {
        const list: Array<{ midi: number; black: boolean; x: number }> = [];
        let whiteIndex = 0;
        for (let midi = low; midi <= high; midi++) {
            const black = BLACK.has(midi % 12);
            if (black) list.push({ midi, black, x: whiteIndex * WHITE_WIDTH - WHITE_WIDTH * 0.3 });
            else list.push({ midi, black, x: whiteIndex++ * WHITE_WIDTH });
        }
        return { list, width: whiteIndex * WHITE_WIDTH };
    }, [low, high]);
    const expectedSet = new Set(expected);
    const heldSet = new Set(held);

    const fill = (midi: number, black: boolean) => {
        const fb = feedback[midi];
        if (fb) return FEEDBACK_COLORS[fb];
        if (heldSet.has(midi)) return black ? "#666" : "#bbb";
        if (expectedSet.has(midi)) return "#4fc3f7";
        return black ? "#222" : "#f5f5f5";
    };

    return (
        <Box sx={{ overflowX: "auto", display: "flex", justifyContent: "center" }} data-testid="on-screen-piano">
            <svg width={keys.width} height={92} viewBox={`0 0 ${keys.width} 92`} role="img" aria-label="On-screen piano">
                {keys.list.filter((k) => !k.black).map((k) => (
                    <g key={k.midi}>
                        <rect x={k.x} y={0} width={WHITE_WIDTH - 1} height={heldSet.has(k.midi) ? 90 : 88} rx={3} fill={fill(k.midi, false)} stroke="#333" />
                        {k.midi % 12 === 0 && <text x={k.x + WHITE_WIDTH / 2} y={82} textAnchor="middle" fontSize={9} fill="#555">{midiNoteName(k.midi)}</text>}
                    </g>
                ))}
                {keys.list.filter((k) => k.black).map((k) => (
                    <rect key={k.midi} x={k.x} y={0} width={WHITE_WIDTH * 0.6} height={56} rx={2} fill={fill(k.midi, true)} stroke="#111" />
                ))}
            </svg>
        </Box>
    );
}
