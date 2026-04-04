import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Box,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { ScaleChordTable } from "../components/scales/ScaleChordTable.tsx";
import { ScaleSettingsDrawer } from "../components/scales/ScaleSettingsDrawer.tsx";
import type {Note, ScaleType, Chord} from "musiclib"
import {naturalNotes, getAllScaleTypes, constructScale, formatNoteASCII, getScaleTypeById, noteFromString} from "musiclib"
import {NoteWheel} from "../components/scales/NoteWheel.tsx";
import {CircleOfFifths} from "../components/scales/CircleOfFifths/CircleOfFifths.tsx";
import { useInstrument, usePreferSimpleSpellings, useStringPreference } from "../utils/preferences.ts";
import { NOTE_DISPLAY_TEXT_SX, useNoteFormatter } from "../utils/noteDisplay.ts";
import {ChordPiano} from "../components/scales/ChordPiano.tsx";
import { normalizeInstrumentName, playChord } from "../audio/soundfont.ts";
import {getDisplayChord, getDisplayScale} from "../utils/chordDisplay.ts";


const SELECTED_NOTE_KEY = "music-helper:selected-note";
const SELECTED_SCALE_TYPE_KEY = "music-helper:selected-scale-type";
const DEFAULT_NOTE = naturalNotes[0] as Note;
const DEFAULT_SCALE_TYPE = getAllScaleTypes()[0] as ScaleType;

function getSavedNote(savedValue: string): Note {
    const parsed = noteFromString(savedValue);
    return parsed ?? DEFAULT_NOTE;
}

function getSavedScaleType(savedValue: string): ScaleType {
    return (getScaleTypeById(savedValue) as ScaleType | undefined) ?? DEFAULT_SCALE_TYPE;
}
export const Route = createFileRoute("/scales")({
    component: ScalePage,
    staticData: {
        title: "Music Helper | Scales",
        showNav: true,
    },
});

// eslint-disable-next-line react-refresh/only-export-components
function ScalePage() {
    const [savedNote, setSavedNote] = useStringPreference(SELECTED_NOTE_KEY, formatNoteASCII(DEFAULT_NOTE))
    const [savedScaleTypeId, setSavedScaleTypeId] = useStringPreference(SELECTED_SCALE_TYPE_KEY, DEFAULT_SCALE_TYPE.id)
    const selectedNote = React.useMemo(() => getSavedNote(savedNote), [savedNote])
    const selectedScaleType = React.useMemo(() => getSavedScaleType(savedScaleTypeId), [savedScaleTypeId])

    const [isScaleDrawerOpen, setIsScaleDrawerOpen] = React.useState(false);
    const [selectedChord, setSelectedChord] = React.useState<Chord | undefined>(undefined);
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const [instrument] = useInstrument();
    const { formatNote } = useNoteFormatter();
    const selectedInstrument = React.useMemo(() => normalizeInstrumentName(instrument), [instrument]);

    useEffect(() => {
        if (selectedChord) {
            playChord(selectedChord, 1, selectedInstrument);
        }
    }, [selectedChord]);

    useEffect(() => {
        setSelectedChord(undefined)
    }, [selectedNote, selectedScaleType]);

    const harmonicScale = React.useMemo(
        () => constructScale(selectedNote, selectedScaleType),
        [selectedNote, selectedScaleType]
    )

    const displayScale = React.useMemo(
        () => getDisplayScale(harmonicScale, preferSimpleSpellings),
        [harmonicScale, preferSimpleSpellings]
    )

    const displaySelectedChord = React.useMemo(
        () => selectedChord ? getDisplayChord(selectedChord, preferSimpleSpellings) : undefined,
        [preferSimpleSpellings, selectedChord]
    )



    return (
        <Box
            sx={{
                minHeight: "calc(100vh - 64px)",
                bgcolor: "background.default",
                p: { xs: 2, md: 3 },
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
            }}
        >
            {!isScaleDrawerOpen && (
                <IconButton
                    onClick={() => setIsScaleDrawerOpen(true)}
                    aria-label="open scale selector"
                    sx={{
                        position: "fixed",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 1199,
                        color: "text.primary",
                        p: 0,
                        minWidth: 0,
                        "&:hover": {
                            bgcolor: "transparent",
                        },
                    }}
                >
                    <ChevronRightIcon />
                </IconButton>
            )}

            <ScaleSettingsDrawer
                open={isScaleDrawerOpen}
                onClose={() => setIsScaleDrawerOpen(false)}
                selectedNote={selectedNote}
                onSelectNote={(note) => setSavedNote(formatNoteASCII(note))}
                selectedScaleType={selectedScaleType}
                onSelectScaleType={(scaleType) => setSavedScaleTypeId(scaleType.id)}
            />

            <Stack spacing={2} sx={{ width: "100%", maxWidth: 980, alignItems: "center", textAlign: "center" }}>
                <Box>
                    <Typography
                        variant="overline"
                        sx={{
                            color: "text.secondary",
                            letterSpacing: "0.18em",
                        }}
                    >
                        Selected Scale
                    </Typography>
                    <Typography
                        sx={{
                            ...NOTE_DISPLAY_TEXT_SX,
                            mt: 0.5,
                            fontSize: { xs: "1.8rem", md: "2.2rem" },
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: "0.01em",
                        }}
                    >
                        {formatNote(displayScale.tonic)}
                    </Typography>
                    <Typography
                        sx={{
                            mt: 0.75,
                            color: "text.secondary",
                            fontSize: { xs: "1rem", md: "1.08rem" },
                            textTransform: "capitalize",
                            letterSpacing: "0.04em",
                        }}
                    >
                        {displayScale.type.name}
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                            gap: 3,
                            alignItems: "start",
                            justifyItems: "center",
                            mt: 2,
                        }}
                    >
                        <NoteWheel selectedScale={displayScale} size={420} />
                        <CircleOfFifths selectedScale={displayScale} size={420} showChords />
                    </Box>
                    <ChordPiano scale={displayScale} selectedChord={displaySelectedChord} showKeyNames={true}/>
                    <ScaleChordTable scale={harmonicScale} onSelectChord={setSelectedChord} selectedChord={selectedChord} />
                </Box>
            </Stack>
        </Box>
    );
}
