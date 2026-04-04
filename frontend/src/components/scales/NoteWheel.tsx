import * as React from "react";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Box, IconButton, useTheme } from "@mui/material";
import { noteFromPitchClass, type Note, type PitchClass, type Scale } from "musiclib";
import { normalizeInstrumentName, playScale } from "../../audio/soundfont.ts";
import { NOTE_DISPLAY_FONT_FAMILY, useNoteFormatter } from "../../utils/noteDisplay.ts";
import { useInstrument } from "../../utils/preferences.ts";

type NoteWheelProps = {
    selectedScale: Scale;
    size?: number | string;
};

const CHROMATIC_NOTES: Note[] = Array.from({ length: 12 }, (_, index) =>
    noteFromPitchClass(index as PitchClass)
);

const OUTER_RADIUS = 45;
const INNER_RADIUS = 30;
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

export function NoteWheel({ selectedScale, size = 480 }: NoteWheelProps) {
    const theme = useTheme();
    const [instrument] = useInstrument();
    const { formatNote } = useNoteFormatter();
    const [activePitch, setActivePitch] = React.useState<number | null>(null);
    const selectedInstrument = normalizeInstrumentName(instrument);
    const sliceSpan = 360 / CHROMATIC_NOTES.length;
    const notesByPitch = new Map(selectedScale.notes.map((note) => [note.pitch, note]));
    const tonicPitch = selectedScale.tonic.pitch;

    const handlePlayScale = () => {
        void playScale(selectedScale, selectedInstrument, 4, 0.42, 0.48, setActivePitch, () => setActivePitch(null));
    };

    React.useEffect(() => {
        setActivePitch(null);
    }, [selectedScale]);

    return (
            <Box sx={{ width: size, maxWidth: "100%", mx: "auto", position: "relative", userSelect: "none", WebkitUserSelect: "none" }}>
                <svg
                    viewBox="0 0 100 100"
                    width="100%"
                    role="img"
                    aria-label={`${formatNote(selectedScale.tonic)} ${selectedScale.type.name} note wheel`}
                    style={{ userSelect: "none", WebkitUserSelect: "none" }}
                >
                    {CHROMATIC_NOTES.map((chromaticNote, index) => {
                        const startAngle = START_ANGLE + index * sliceSpan + GAP_DEGREES / 2;
                        const endAngle = START_ANGLE + (index + 1) * sliceSpan - GAP_DEGREES / 2;
                        const midAngle = (startAngle + endAngle) / 2;
                        const scaleNote = notesByPitch.get(chromaticNote.pitch);
                        const isAllowed = scaleNote !== undefined;
                        const isTonic = chromaticNote.pitch === tonicPitch;
                        const isActive = chromaticNote.pitch === activePitch;
                        const labelPoint = polarToCartesian(50, 50, (OUTER_RADIUS + INNER_RADIUS) / 2, midAngle);
                        const fill = isAllowed
                            ? isActive
                                ? theme.palette.secondary.main
                                : isTonic
                                    ? theme.palette.grey[700]
                                    : theme.palette.grey[800]
                            : theme.palette.grey[900];

                        return (
                            <g key={chromaticNote.pitch}>
                                <path d={ringSlicePath(OUTER_RADIUS, INNER_RADIUS, startAngle, endAngle)} fill={fill} />
                                {isAllowed && scaleNote ? (
                                    <text
                                        x={labelPoint.x}
                                        y={labelPoint.y}
                                        fill={theme.palette.common.white}
                                        fontSize="5.2"
                                        fontWeight="700"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ letterSpacing: "0.02em", userSelect: "none", WebkitUserSelect: "none", fontFamily: NOTE_DISPLAY_FONT_FAMILY }}
                                    >
                                        {formatNote(scaleNote)}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}
                </svg>
                <IconButton
                    onClick={handlePlayScale}
                    aria-label={`Play ${formatNote(selectedScale.tonic)} ${selectedScale.type.name} scale`}
                    sx={{
                        position: "absolute",
                        inset: 0,
                        margin: "auto",
                        width: "17%",
                        height: "17%",
                        minWidth: 0,
                        minHeight: 0,
                        p: 0,
                        borderRadius: "50%",
                        border: `2px solid ${theme.palette.divider}`,
                        bgcolor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        boxShadow: theme.shadows[3],
                        "&:hover": {
                            bgcolor: theme.palette.grey[100],
                        },
                    }}
                >
                    <PlayArrowIcon sx={{ fontSize: "1.45rem" }} />
                </IconButton>
            </Box>
    );
}
