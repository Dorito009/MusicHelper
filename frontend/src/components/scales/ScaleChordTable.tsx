import * as React from "react";
import { alpha, Box, Stack, Typography, useTheme } from "@mui/material";
import { formatNoteASCII, simplifyScale, type Scale , type Chord} from "musiclib";
import { type ChordVisibilityKey, useChordVisibilityPreferences, usePreferSimpleChordLabels } from "../../utils/preferences.ts";

type ScaleChordTableProps = {
    scale: Scale;
    selectedChord?: Chord;
    onSelectChord: (chord: Chord) => void
};

type ChordCell = {
    root: { pitch: number };
    symbol: string;
    chord: Chord;
};

type ChordSection = {
    key: ChordVisibilityKey;
    label: string;
    getChords: (scale: Scale) => Array<ChordCell | null>;
};

function alignChordRow(
    roots: Scale["degrees"],
    chords: ChordCell[]
): Array<ChordCell | null> {
    const chordsByPitch = new Map(chords.map((chord) => [chord.root.pitch, chord]));
    return roots.map((degree) => chordsByPitch.get(degree.note.pitch) ?? null);
}

function chordToChordCell(chord: Chord | null): ChordCell | null {
    if (!chord) return null
    return {
        root: chord.root,
        symbol: chord.symbol,
        chord: chord
    };
}
const CHORD_SECTIONS: ChordSection[] = [
    { key: "sus2", label: "Sus2", getChords: (scale) => (scale.derivedChords?.byKind.sus2 ?? []).map(chordToChordCell) },
    { key: "triads", label: "Triad", getChords: (scale) => alignChordRow(scale.degrees, (scale.harmony?.triads ?? []).map(c => chordToChordCell(c)!)) },
    { key: "sus4", label: "Sus4", getChords: (scale) => (scale.derivedChords?.byKind.sus4 ?? []).map(chordToChordCell) },
    { key: "sevenths", label: "7", getChords: (scale) => alignChordRow(scale.degrees, (scale.harmony?.sevenths ?? []).map(c => chordToChordCell(c)!)) },
    { key: "fifths", label: "5", getChords: (scale) => (scale.derivedChords?.byKind.c5 ?? []).map(chordToChordCell) },
    { key: "sixths", label: "6", getChords: (scale) => (scale.derivedChords?.byKind.c6 ?? []).map(chordToChordCell) },
    { key: "add9", label: "9", getChords: (scale) => (scale.derivedChords?.byKind.add9 ?? []).map(chordToChordCell) },
];

export function ScaleChordTable({ scale, selectedChord, onSelectChord}: ScaleChordTableProps) {
    const theme = useTheme();
    const [preferSimpleChordLabels] = usePreferSimpleChordLabels();
    const [chordVisibility] = useChordVisibilityPreferences();

    const simplifiedScale = React.useMemo(() => simplifyScale(scale), [scale]);

    const chordLabelScale = React.useMemo(
        () => (preferSimpleChordLabels ? simplifiedScale : scale),
        [preferSimpleChordLabels, scale, simplifiedScale]
    );

    const visibleChordSections = React.useMemo(
        () => CHORD_SECTIONS
            .filter((section) => chordVisibility[section.key])
            .map((section) => ({
                ...section,
                chords: section.getChords(chordLabelScale),
            }))
            .filter((section) => section.chords.some(Boolean)),
        [chordLabelScale, chordVisibility]
    );

    if (visibleChordSections.length === 0) {
        return null;
    }

    return (
        <Box
            sx={{
                mt: 3,
                width: "100%",
                borderRadius: 3,
                overflow: "hidden",
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.9),
                bgcolor: alpha(theme.palette.background.paper, 0.92),
                boxShadow: `0 20px 44px ${alpha(theme.palette.common.black, 0.14)}`,
                backdropFilter: "blur(12px)",
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: `minmax(112px, 1.08fr) repeat(${chordLabelScale.degrees.length}, minmax(0, 1fr))`,
                    borderBottom: "1px solid",
                    borderColor: alpha(theme.palette.divider, 0.8),
                }}
            >
                <Box
                    sx={{
                        px: 1.2,
                        py: 1.1,
                        minHeight: 52,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRight: "1px solid",
                        borderColor: alpha(theme.palette.divider, 0.8),
                        bgcolor: alpha(theme.palette.background.default, 0.22),
                    }}
                >
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.74rem", md: "0.8rem" }, letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", userSelect: "none" }}>
                        Root Notes
                    </Typography>
                </Box>
                {chordLabelScale.degrees.map((degree, index) => (
                    <Box
                        key={`root-${degree.degree}-${index}`}
                        sx={{
                            px: 1,
                            py: 1.1,
                            minHeight: 52,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRight: index < chordLabelScale.degrees.length - 1 ? "1px solid" : "none",
                            borderColor: alpha(theme.palette.divider, 0.8),
                            bgcolor: alpha(theme.palette.secondary.main, degree.degree === 1 ? 0.14 : 0.06),
                        }}
                    >
                        <Typography sx={{ fontWeight: 700, fontSize: { xs: "0.92rem", md: "1rem" }, userSelect: "none" }}>
                            {formatNoteASCII(degree.note)}
                        </Typography>
                    </Box>
                ))}
            </Box>

            <Stack spacing={0}>
                {visibleChordSections.map((section, sectionIndex) => (
                    <Box
                        key={section.key}
                        sx={{
                            display: "grid",
                            gridTemplateColumns: `minmax(112px, 1.08fr) repeat(${chordLabelScale.degrees.length}, minmax(0, 1fr))`,
                        }}
                    >
                        <Box
                            sx={{
                                px: 1.2,
                                py: 1.35,
                                minHeight: 60,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRight: "1px solid",
                                borderBottom: sectionIndex < visibleChordSections.length - 1 ? "1px solid" : "none",
                                borderColor: alpha(theme.palette.divider, 0.8),
                                bgcolor: alpha(theme.palette.background.default, 0.22),
                            }}
                        >
                            <Typography sx={{ fontWeight: 800, fontSize: { xs: "0.74rem", md: "0.8rem" }, letterSpacing: "0.14em", textTransform: "uppercase", color: "text.secondary", userSelect: "none", }}>
                                {section.label}
                            </Typography>
                        </Box>
                        {section.chords.map((chord, index) => {
                           const isSelectedChord = chord?.chord.symbol === selectedChord?.symbol

                           return <Box
                                key={`${section.key}-${index}`}
                                sx={{
                                    px: 1,
                                    py: 1.35,
                                    minHeight: 60,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRight: index < chordLabelScale.degrees.length - 1 ? "1px solid" : "none",
                                    borderBottom: sectionIndex < visibleChordSections.length - 1 ? "1px solid" : "none",
                                    borderColor: alpha(theme.palette.divider, 0.8),
                                    bgcolor: chord
                                        ? (isSelectedChord ? alpha(theme.palette.success.light, 0.5) : alpha(theme.palette.success.light, 0.12))
                                        : alpha(theme.palette.background.default, 0.18),
                                }}
                                onClick={() => {
                                    console.log("clicked")
                                    if (chord?.chord) {
                                        onSelectChord(chord.chord)
                                    }
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontWeight: chord ? 700 : 500,
                                        fontSize: {xs: "0.92rem", md: "1rem"},
                                        color: chord ? "text.primary" : "text.disabled",
                                        userSelect: "none",
                                    }}
                                >
                                    {chord?.symbol ?? ""}
                                </Typography>
                            </Box>
                        })}
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}
