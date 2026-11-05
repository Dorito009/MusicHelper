import {Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, Box, Typography, DialogActions, Button } from "@mui/material";
import type {Chord, Note, ChordType, ChordFamily} from "musiclib"
import {useState} from "react";
import CloseIcon from '@mui/icons-material/Close';
import {buildChord, notePairs, getAllChordTypes, formatNoteASCII} from "musiclib"
import {NOTE_DISPLAY_TEXT_SX, useNoteFormatter} from "../utils/noteDisplay.ts";
import {usePreferSimpleSpellings} from "../utils/preferences.ts";
import {getDisplayChord} from "../utils/chordDisplay.ts";

const FAMILY_ORDER: ChordFamily[] = ["power", "suspended", "triad", "seventh", "sixth", "added-tone"];
const CHORD_TYPE_ORDER: Record<ChordFamily, string[]> = {
    power: ["5"],
    suspended: ["sus2", "sus4"],
    triad: ["maj", "min", "dim", "aug"],
    seventh: ["7", "maj7", "m7", "mmaj7", "m7b5", "dim7", "maj7#5"],
    sixth: ["6", "m6", "6/9", "m6/9"],
    "added-tone": ["add9", "madd9"],
};
const FAMILY_LABELS: Record<ChordFamily, string> = {
    triad: "Triads",
    seventh: "Sevenths",
    sixth: "Sixths",
    suspended: "Suspended",
    "added-tone": "Added Tone",
    power: "Power ",
};

const CHORD_TYPE_GROUPS = FAMILY_ORDER.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    chordTypes: getAllChordTypes()
        .filter((chordType) => chordType.family === family)
        .sort((a, b) => {
            const familyOrder = CHORD_TYPE_ORDER[family];
            const aIndex = familyOrder.indexOf(a.id);
            const bIndex = familyOrder.indexOf(b.id);

            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }

            if (aIndex !== -1) {
                return -1;
            }

            if (bIndex !== -1) {
                return 1;
            }

            return a.name.localeCompare(b.name);
        }),
})).filter((group) => group.chordTypes.length > 0);

type ChordDialogProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (chord: Chord) => void;
}

function renderNoteList(notes: Note[], formatNote: (note: Note) => string) {
    return notes.map((note, index) => (
        <Box component="span" key={`${note.pitch}-${index}`}>
            {index > 0 ? <Box component="span"> - </Box> : null}
            <Box component="span" sx={NOTE_DISPLAY_TEXT_SX}>{formatNote(note)}</Box>
        </Box>
    ));
}



export function ChordDialog({open, onClose, onSubmit}: ChordDialogProps) {
    const { formatNote, formatText } = useNoteFormatter();
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [selectedChordType, setSelectedChordType] = useState<ChordType | null>(null);
    const previewChord = selectedNote && selectedChordType
        ? (() => {
            const chord = buildChord(selectedNote, selectedChordType);
            return getDisplayChord(chord, preferSimpleSpellings);
        })()
        : null;

    return (
        <Dialog open={open} onClose={onClose}  maxWidth="lg">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Add Chord
                <IconButton
                    onClick={onClose}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{
                flex: "0 0 auto",
                overflow: "visible",
                paddingBottom: 3,
            }} >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Typography
                        variant="overline"
                        sx={{
                            color: "text.secondary",
                            letterSpacing: "0.18em",
                            marginBottom: 2
                        }}
                    >
                        Select Root Note:
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{alignItems: "center" }}>
                        {notePairs.map((notePair, notePairIndex) => (
                            <Stack key={`note-pair-${notePairIndex}`} spacing={1} >
                                {notePair.map(note => {

                                    const isSelectedNote = selectedNote?.letter === note.letter
                                        && selectedNote?.alter === note.alter;

                                    return <Chip
                                        key={formatNoteASCII(note)}
                                        label={formatNote(note)}
                                        clickable
                                        size="medium"
                                        onClick={() => setSelectedNote(note)}
                                        color={isSelectedNote ? "secondary" : "default"}
                                        variant={isSelectedNote ? "filled" : "outlined"}
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: "50%",
                                            "& .MuiChip-label": {
                                                px: 0,
                                                fontSize: "0.78rem",
                                                fontWeight: 400,
                                                ...NOTE_DISPLAY_TEXT_SX,
                                            },
                                        }}
                                    >

                                    </Chip>


                                })}
                            </Stack>
                        ))}

                    </Stack>
                </Box>
            </DialogContent>
            <DialogContent dividers >
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Typography
                        variant="overline"
                        sx={{
                            color: "text.secondary",
                            letterSpacing: "0.18em",
                            marginBottom: 2
                        }}
                    >
                        Select Chord Type
                    </Typography>

                    <Stack spacing={1.5} sx={{ width: "100%", maxWidth: 720 }}>
                        {CHORD_TYPE_GROUPS.map(({family, label, chordTypes}) => (
                            <Box
                                key={family}
                                sx={{
                                    display: "flex",
                                    flexDirection: { xs: "column", sm: "row" },
                                    gap: 1.5,
                                    alignItems: { xs: "flex-start", sm: "center" },
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{
                                        minWidth: { sm: 86 },
                                        color: "text.secondary",
                                        fontWeight: 700,
                                        letterSpacing: 0.4,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {label}
                                </Typography>

                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                    {chordTypes.map((chordType) => {
                                        const isSelectedChordType = selectedChordType?.id === chordType.id;
                                        const shortLabel = chordType.shortName || chordType.id;

                                        return (
                                            <Chip
                                                key={chordType.id}
                                                clickable
                                                onClick={() => setSelectedChordType(chordType)}
                                                color={isSelectedChordType ? "secondary" : "default"}
                                                variant={isSelectedChordType ? "filled" : "outlined"}
                                                label={
                                                    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
                                                        <Typography component="span" sx={{ ...NOTE_DISPLAY_TEXT_SX, fontSize: "0.82rem", fontWeight: 700 }}>
                                                            {formatText(shortLabel)}
                                                        </Typography>
                                                        {shortLabel !== chordType.name && (
                                                            <Typography
                                                                component="span"
                                                                sx={{
                                                                    fontSize: "0.74rem",
                                                                    color: isSelectedChordType ? "common.black" : "text.secondary",
                                                                }}
                                                            >
                                                                {chordType.name}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                }
                                                sx={{
                                                    minHeight: 36,
                                                    borderRadius: 18,
                                                    px: 0.5,
                                                    "& .MuiChip-label": {
                                                        display: "block",
                                                        px: 1,
                                                        py: 0.25,
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        ))}
                    </Stack>

                </Box>
            </DialogContent>
            <DialogActions sx={{ position: "relative", justifyContent: "flex-end" }}>
                {previewChord && (
                    <Typography
                        variant="body2"
                        sx={{
                            position: "absolute",
                            left: "50%",
                            transform: "translateX(-50%)",
                            color: "text.secondary",
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: { xs: "calc(100% - 140px)", sm: "calc(100% - 180px)" },
                            pointerEvents: "none",
                        }}
                    >
                        <Box component="span" sx={{ ...NOTE_DISPLAY_TEXT_SX, color: "text.primary", fontWeight: 700 }}>
                            {formatText(previewChord.symbol)}
                        </Box>
                        : {renderNoteList(previewChord.notes, formatNote)}
                    </Typography>
                )}
                <Button
                    disabled={!previewChord}
                    onClick={() => onSubmit(previewChord!)}
                >
                    Add Chord
                </Button>
            </DialogActions>

        </Dialog>
    )
}
