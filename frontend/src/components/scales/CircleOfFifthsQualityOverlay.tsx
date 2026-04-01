import { Box } from "@mui/material";
import type { NoteQuality, PitchClass, ScaleDegree } from "musiclib";

type CircleOfFifthsQualityOverlayProps = {
    size?: number | string;
    noteOrder?: readonly PitchClass[];
    scaleDegrees: readonly ScaleDegree[];
};

type QualityArc = {
    quality: NoteQuality;
    startIndex: number;
    endIndex: number;
};

const DEFAULT_NOTE_ORDER: readonly PitchClass[] = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const QUALITY_ORDER: readonly NoteQuality[] = ["maj", "min", "dim", "aug"];
const QUALITY_STYLE: Record<NoteQuality, { text: string; color: string; labelColor: string }> = {
    maj: {
        text: "MAJOR",
        color: "rgba(244, 171, 171, 0.45)",
        labelColor: "rgba(244, 171, 171, 0.82)",
    },
    min: {
        text: "MINOR",
        color: "rgba(165, 203, 241, 0.42)",
        labelColor: "rgba(165, 203, 241, 0.82)",
    },
    dim: {
        text: "DIMINISHED",
        color: "rgba(151, 227, 182, 0.45)",
        labelColor: "rgba(151, 227, 182, 0.82)",
    },
    aug: {
        text: "AUGMENTED",
        color: "rgba(245, 201, 123, 0.46)",
        labelColor: "rgba(245, 201, 123, 0.84)",
    },
};

const SECTOR_ANGLE = 30;
const BAND_OUTER_RADIUS = 49.6;
const BAND_INNER_RADIUS = 46.8;
const LABEL_RADIUS = 51.5;
const START_ANGLE = -105;
const GAP_DEGREES = 0.9;

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: cx + Math.cos(radians) * radius,
        y: cy + Math.sin(radians) * radius,
    };
}

function ringSlicePath(outerRadius: number, innerRadius: number, startAngle: number, endAngle: number) {
    const outerStart = polarToCartesian(50, 50, outerRadius, startAngle);
    const outerEnd = polarToCartesian(50, 50, outerRadius, endAngle);
    const innerEnd = polarToCartesian(50, 50, innerRadius, endAngle);
    const innerStart = polarToCartesian(50, 50, innerRadius, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
        "Z",
    ].join(" ");
}

function getSectorStartAngle(index: number) {
    return START_ANGLE + index * SECTOR_ANGLE + GAP_DEGREES / 2;
}

function getSectorEndAngle(index: number) {
    return START_ANGLE + (index + 1) * SECTOR_ANGLE - GAP_DEGREES / 2;
}

function buildQualityArcs(noteOrder: readonly PitchClass[], scaleDegrees: readonly ScaleDegree[]): QualityArc[] {
    const degreesByPitch = new Map(scaleDegrees.map((degree) => [degree.note.pitch, degree]));
    const arcs: QualityArc[] = [];

    for (const quality of QUALITY_ORDER) {
        const indexes = noteOrder
            .map((pitch, index) => ({ pitch, index }))
            .filter(({ pitch }) => degreesByPitch.get(pitch)?.quality === quality)
            .map(({ index }) => index);

        if (indexes.length === 0) {
            continue;
        }

        const runs: Array<{ startIndex: number; endIndex: number }> = [];
        let startIndex = indexes[0];
        let endIndex = indexes[0];

        for (let i = 1; i < indexes.length; i += 1) {
            const currentIndex = indexes[i];

            if (currentIndex === endIndex + 1) {
                endIndex = currentIndex;
                continue;
            }

            runs.push({ startIndex, endIndex });
            startIndex = currentIndex;
            endIndex = currentIndex;
        }

        runs.push({ startIndex, endIndex });

        if (runs.length > 1 && runs[0].startIndex === 0 && runs[runs.length - 1].endIndex === noteOrder.length - 1) {
            const firstRun = runs.shift();
            const lastRun = runs.pop();

            if (firstRun && lastRun) {
                runs.unshift({
                    startIndex: lastRun.startIndex,
                    endIndex: firstRun.endIndex,
                });
            }
        }

        for (const run of runs) {
            arcs.push({
                quality,
                startIndex: run.startIndex,
                endIndex: run.endIndex,
            });
        }
    }

    return arcs;
}

export function CircleOfFifthsQualityOverlay({
    size = 420,
    noteOrder = DEFAULT_NOTE_ORDER,
    scaleDegrees,
}: CircleOfFifthsQualityOverlayProps) {
    const arcs = buildQualityArcs(noteOrder, scaleDegrees);

    if (arcs.length === 0) {
        return null;
    }

    return (
        <Box sx={{ width: size, maxWidth: "100%", height: "100%", position: "relative", pointerEvents: "none", overflow: "visible", userSelect: "none", WebkitUserSelect: "none" }}>
            <svg viewBox="0 0 100 100" width="100%" role="presentation" style={{ overflow: "visible", userSelect: "none", WebkitUserSelect: "none" }}>
                {arcs.map((arc) => {
                    const style = QUALITY_STYLE[arc.quality];
                    const startAngle = getSectorStartAngle(arc.startIndex);
                    const rawEndAngle = getSectorEndAngle(arc.endIndex);
                    const endAngle = arc.endIndex < arc.startIndex ? rawEndAngle + 360 : rawEndAngle;
                    const centerAngle = (startAngle + endAngle) / 2;
                    const point = polarToCartesian(50, 50, LABEL_RADIUS, centerAngle);

                    return (
                        <g key={`${arc.quality}-${arc.startIndex}-${arc.endIndex}`}>
                            <path
                                d={ringSlicePath(BAND_OUTER_RADIUS, BAND_INNER_RADIUS, startAngle, endAngle)}
                                fill={style.color}
                            />
                            <text
                                x={point.x}
                                y={point.y}
                                fill={style.labelColor}
                                fontSize="2.15"
                                fontWeight="700"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                transform={`rotate(${centerAngle + 90} ${point.x} ${point.y})`}
                                style={{ letterSpacing: "0.18em", userSelect: "none", WebkitUserSelect: "none" }}
                            >
                                {style.text}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </Box>
    );
}
