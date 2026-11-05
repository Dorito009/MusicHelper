import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import type { Chord, Scale, Note, PitchClass } from "musiclib";
import { pianoNotes, simplifyNote } from "musiclib";
import { Box, Typography, useTheme } from "@mui/material";
import React from "react";
import { NOTE_DISPLAY_TEXT_SX, useNoteFormatter } from "../utils/noteDisplay.ts";
import { usePreferSimpleSpellings } from "../utils/preferences.ts";

type ChordPianoProps = {
    scale?: Scale;
    selectedChord?: Chord;
    showKeyNames?: boolean;
};

const WHITE_KEYS = pianoNotes.filter(note => note.alter === 0);
const BLACK_KEYS = pianoNotes.filter(note => note.alter === 1);

function getPitchClass(pitch: number): number {
    return ((pitch % 12) + 12) % 12;
}

function getChordNotesIn2Octaves(notes: Note[]): Note[] {
    if (!notes || notes.length === 0) return [];
    if (notes.length === 1) return notes;

    const result = [notes[0]];

    for (let i = 1; i < notes.length; i++) {
        const prevNote = result[i - 1];
        const currentNote = notes[i];

        let adjustedPitch = currentNote.pitch;

        while (adjustedPitch <= prevNote.pitch) {
            adjustedPitch += 12;
        }

        result.push({
            ...currentNote,
            pitch: adjustedPitch,
        });
    }

    return result;
}

type VisibleWhiteKey = Note & {
    visiblePitch: number;
};

type VisibleBlackKey = Note & {
    visiblePitch: number;
    whiteIndexBefore: number;
};

function buildVisibleWhiteKeys(): VisibleWhiteKey[] {
    return [
        ...WHITE_KEYS.map(note => ({ ...note, visiblePitch: note.pitch })),
        ...WHITE_KEYS.map(note => ({ ...note, visiblePitch: note.pitch + 12 })),
        ...WHITE_KEYS.slice(0, 2).map(note => ({ ...note, visiblePitch: note.pitch + 24 })), // C, D
    ];
}

function buildVisibleBlackKeys(): VisibleBlackKey[] {
    const whiteIndexBeforeByPitchClass: Record<number, number> = {
        1: 0,  // C#
        3: 1,  // D#
        6: 3,  // F#
        8: 4,  // G#
        10: 5, // A#
    };

    const octave0 = BLACK_KEYS.map(note => ({
        ...note,
        visiblePitch: note.pitch,
        whiteIndexBefore: whiteIndexBeforeByPitchClass[getPitchClass(note.pitch)],
    }));

    const octave1 = BLACK_KEYS.map(note => ({
        ...note,
        visiblePitch: note.pitch + 12,
        whiteIndexBefore: whiteIndexBeforeByPitchClass[getPitchClass(note.pitch)] + 7,
    }));

    const extra = BLACK_KEYS.slice(0, 1).map(note => ({
        ...note,
        visiblePitch: note.pitch + 24, // C#
        whiteIndexBefore: whiteIndexBeforeByPitchClass[getPitchClass(note.pitch)] + 14,
    }));

    return [...octave0, ...octave1, ...extra];
}

export function ChordPiano({
                                scale,
                                selectedChord,
                                showKeyNames = false,
                            }: ChordPianoProps) {
    const theme = useTheme();
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const { formatNote, formatText } = useNoteFormatter();

    let notesInChord = selectedChord?.notes ?? [];

    if (preferSimpleSpellings) {
        notesInChord = notesInChord.map(n => simplifyNote(n));
    }

    const chordNotesIn2Octaves = React.useMemo(
        () => getChordNotesIn2Octaves(notesInChord),
        [notesInChord]
    );

    const visibleWhiteKeys = React.useMemo(() => buildVisibleWhiteKeys(), []);
    const visibleBlackKeys = React.useMemo(() => buildVisibleBlackKeys(), []);

    const chordVisiblePitches = new Set(
        chordNotesIn2Octaves.map(note => note.pitch)
    );

    const pitchesInScale = new Set(
        scale?.notes.map(note => getPitchClass(note.pitch)) ?? pianoNotes.map(note => getPitchClass(note.pitch))
    );

    const whiteKeyWidth = 55;
    const whiteKeyHeight = 110;
    const blackKeyHeight = whiteKeyHeight * 0.6;

    const isNoteInChord = (visiblePitch: number): boolean => {
        return chordVisiblePitches.has(visiblePitch as PitchClass);
    };

    return (
        <Box
            sx={{
                mt: 3,
                position: "relative",
                width: "100%",
                maxWidth: `${visibleWhiteKeys.length * whiteKeyWidth}px`,
                mx: "auto",
            }}
        >
            <Box
                sx={{
                    mb: 2,
                    textAlign: "center",
                    minHeight: 56, // reserves space so layout doesn't jump
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                }}
            >
                <Typography variant="caption" sx={{ ...NOTE_DISPLAY_TEXT_SX, color: "text.secondary" }}>
                    {selectedChord ? `Notes in ${formatText(selectedChord.symbol)}:` : "Chord Notes:"}
                </Typography>

                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 0.5,
                        visibility: chordNotesIn2Octaves.length > 0 ? "visible" : "hidden",
                    }}
                >
                    {chordNotesIn2Octaves.length > 0
                        ? chordNotesIn2Octaves.map((note, idx) => (
                            <React.Fragment key={idx}>
                                {idx > 0 && (
                                    <Box
                                        component="span"
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "text.secondary",
                                            lineHeight: 1,
                                        }}
                                    >
                                        <ArrowForwardRoundedIcon sx={{ fontSize: "1rem" }} />
                                    </Box>
                                )}
                                        <Box component="span" sx={{ ...NOTE_DISPLAY_TEXT_SX, color: "primary.main", lineHeight: 1.1 }}>
                                    {formatNote(note)}
                                </Box>
                            </React.Fragment>
                        ))
                        : " "}
                </Typography>
            </Box>

            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    height: whiteKeyHeight,
                    userSelect: "none",
                    bgcolor: theme.palette.background.paper,
                    borderRadius: 1,
                    overflow: "hidden",
                }}
            >
                <Box sx={{ display: "flex", height: "100%" }}>
                    {visibleWhiteKeys.map((note, idx) => {
                        const isInChord = isNoteInChord(note.visiblePitch);
                        const isInScale = pitchesInScale.has(
                            getPitchClass(note.visiblePitch) as PitchClass
                        );

                        return (
                            <Box
                                key={`white-${idx}-${note.visiblePitch}`}
                                sx={{
                                    flex: 1,
                                    height: "100%",
                                    border: "0px solid",
                                    borderColor: "divider",
                                    borderRadius: 1,
                                    bgcolor: isInChord
                                        ? theme.palette.secondary.dark
                                        : isInScale
                                            ? theme.palette.grey[700]
                                            : theme.palette.grey[900],
                                    transition: "background-color 0.2s",
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "center",
                                    pb: 1,
                                }}
                            >
                                {showKeyNames && isInScale && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: "0.65rem",
                                            color: isInChord
                                                ? "primary.contrastText"
                                                : "text.secondary",
                                            fontWeight: isInChord ? 700 : 500,
                                        }}
                                    >
                                        <Box component="span" sx={NOTE_DISPLAY_TEXT_SX}>{formatNote(note)}</Box>
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>

                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: whiteKeyHeight,
                        pointerEvents: "none",
                    }}
                >
                    {visibleBlackKeys.map((note, idx) => {
                        const isInChord = isNoteInChord(note.visiblePitch);
                        const isInScale = pitchesInScale.has(
                            getPitchClass(note.visiblePitch) as PitchClass
                        );

                        const whiteKeySpacing = 100 / visibleWhiteKeys.length;
                        const blackKeyWidth = whiteKeySpacing * 0.4;
                        const left =
                            (note.whiteIndexBefore + 1) * whiteKeySpacing - blackKeyWidth / 2;

                        return (
                            <Box
                                key={`black-${idx}-${note.visiblePitch}`}
                                sx={{
                                    position: "absolute",
                                    left: `${left}%`,
                                    top: 0,
                                    width: `${blackKeyWidth}%`,
                                    height: `${(blackKeyHeight / whiteKeyHeight) * 100}%`,
                                    bgcolor: isInChord
                                        ? theme.palette.secondary.dark
                                        : isInScale
                                            ? "#000000"
                                            : theme.palette.background.default,
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: theme.palette.divider,
                                    transition: "background-color 0.2s",
                                    pointerEvents: "none",
                                    zIndex: 10,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    justifyContent: "center",
                                    pb: 0.5,
                                }}
                            >
                                {showKeyNames && isInScale && (
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: "0.55rem",
                                            color: isInChord
                                                ? "primary.contrastText"
                                                : "text.primary",
                                            fontWeight: isInChord ? 700 : 500,
                                        }}
                                    >
                                        <Box component="span" sx={NOTE_DISPLAY_TEXT_SX}>{formatNote(note)}</Box>
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}
