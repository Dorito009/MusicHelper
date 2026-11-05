import { Box, useTheme } from "@mui/material";
import { noteFromPitchClass, type PitchClass, type Scale, type ScaleDegree } from "musiclib";
import { CircleOfFifthsQualityOverlay } from "./CircleOfFifthsQualityOverlay.tsx";
import { NOTE_DISPLAY_FONT_FAMILY, useNoteFormatter } from "../../utils/noteDisplay.ts";

type CircleOfFifthsProps = {
    selectedScale: Scale;
    size?: number | string;
    showChords?: boolean;
};

const FIFTHS_ORDER: PitchClass[] = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const OUTER_RADIUS = 45;
const OUTER_INNER_RADIUS = 30;
const INNER_RADIUS = 20;
const START_ANGLE = -105;
const GAP_DEGREES = 0.9;
const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;

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

function getSectorStartAngle(index: number, sliceSpan: number) {
    return START_ANGLE + index * sliceSpan + GAP_DEGREES / 2;
}

function getSectorEndAngle(index: number, sliceSpan: number) {
    return START_ANGLE + (index + 1) * sliceSpan - GAP_DEGREES / 2;
}

function formatRomanNumeral(scaleDegree: ScaleDegree | undefined): string {
    if (!scaleDegree) {
        return "";
    }

    const numeral = ROMAN_NUMERALS[scaleDegree.degree - 1] ?? String(scaleDegree.degree);

    switch (scaleDegree.quality) {
        case "min":
            return numeral.toLowerCase();
        case "dim":
            return `${numeral.toLowerCase()}°`;
        case "aug":
            return `${numeral}+`;
        case "maj":
        case undefined:
        default:
            return numeral;
    }
}

export function CircleOfFifths({ selectedScale, size = 420, showChords = false }: CircleOfFifthsProps) {
    const theme = useTheme();
    const { formatNote } = useNoteFormatter();
    const sliceSpan = 360 / FIFTHS_ORDER.length;
    const notesByPitch = new Map(selectedScale.notes.map((note) => [note.pitch, note]));
    const scaleDegreesByPitch = new Map(selectedScale.degrees.map((degree) => [degree.note.pitch, degree]));
    const hasChordQuality = selectedScale.degrees.some((degree) => degree.quality !== undefined);
    const shouldShowChordLayers = showChords && hasChordQuality;

    return (
        <Box
            sx={{
                width: size,
                maxWidth: "100%",
                mx: "auto",
                position: "relative",
                overflow: "visible",
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
        >
            <svg
                viewBox="0 0 100 100"
                width="100%"
                role="img"
                aria-label={`${formatNote(selectedScale.tonic)} ${selectedScale.type.name} circle of fifths`}
                style={{ userSelect: "none", WebkitUserSelect: "none" }}
            >
                {FIFTHS_ORDER.map((pitch, index) => {
                    const startAngle = getSectorStartAngle(index, sliceSpan);
                    const endAngle = getSectorEndAngle(index, sliceSpan);
                    const midAngle = (startAngle + endAngle) / 2;
                    const chromaticNote = noteFromPitchClass(pitch);
                    const scaleNote = notesByPitch.get(pitch);
                    const scaleDegree = scaleDegreesByPitch.get(pitch);
                    const displayNote = scaleNote ?? chromaticNote;
                    const isScaleNote = scaleNote !== undefined;
                    const isTonic = pitch === selectedScale.tonic.pitch;
                    const outerLabelPoint = polarToCartesian(50, 50, (OUTER_RADIUS + OUTER_INNER_RADIUS) / 2, midAngle);
                    const innerLabelPoint = polarToCartesian(50, 50, (OUTER_INNER_RADIUS + INNER_RADIUS) / 2, midAngle);
                    const outerFill = isTonic
                        ? theme.palette.grey[700]
                        : isScaleNote
                            ? theme.palette.grey[800]
                            : theme.palette.grey[900];
                    const innerFill = isTonic
                        ? "rgba(255,255,255,0.22)"
                        : isScaleNote
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.02)";

                    return (
                        <g key={pitch}>
                            <path d={ringSlicePath(OUTER_RADIUS, OUTER_INNER_RADIUS, startAngle, endAngle)} fill={outerFill} />
                            {shouldShowChordLayers ? (
                                <path d={ringSlicePath(OUTER_INNER_RADIUS - 1, INNER_RADIUS, startAngle, endAngle)} fill={innerFill} />
                            ) : null}

                            {isScaleNote ? (
                                <text
                                    x={outerLabelPoint.x}
                                    y={outerLabelPoint.y}
                                    fill={theme.palette.common.white}
                                    fontSize="4.7"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    style={{ userSelect: "none", WebkitUserSelect: "none", fontFamily: NOTE_DISPLAY_FONT_FAMILY }}
                                >
                                    {formatNote(displayNote)}
                                </text>
                            ) : null}

                            {shouldShowChordLayers ? (
                                <text
                                    x={innerLabelPoint.x}
                                    y={innerLabelPoint.y}
                                    fill={scaleDegree ? theme.palette.grey[100] : theme.palette.grey[600]}
                                    fontSize="2.75"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    style={{ letterSpacing: "0.03em", userSelect: "none", WebkitUserSelect: "none" }}
                                >
                                    {formatRomanNumeral(scaleDegree)}
                                </text>
                            ) : null}
                        </g>
                    );
                })}
            </svg>

            {shouldShowChordLayers ? (
                <Box sx={{ position: "absolute", inset: 0 }}>
                    <CircleOfFifthsQualityOverlay size="100%" noteOrder={FIFTHS_ORDER} scaleDegrees={selectedScale.degrees} />
                </Box>
            ) : null}
        </Box>
    );
}
