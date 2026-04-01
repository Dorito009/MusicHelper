import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Box,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { ScaleSettingsDrawer } from "../components/scales/ScaleSettingsDrawer.tsx";
import type {Note, ScaleType} from "musiclib"
import {naturalNotes, getAllScaleTypes, constructScale, formatNote, formatNoteASCII, getScaleTypeById, noteFromString, simplifyScale} from "musiclib"
import {NoteWheel} from "../components/scales/NoteWheel.tsx";
import {CircleOfFifths} from "../components/scales/CircleOfFifths.tsx";
import { usePreferSimpleSpellings, useStringPreference } from "../utils/preferences.ts";

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
    const [preferSimpleSpellings] = usePreferSimpleSpellings();

    const scale = React.useMemo(() => {
        const constructedScale = constructScale(selectedNote, selectedScaleType)
        return preferSimpleSpellings ? simplifyScale(constructedScale) : constructedScale
    }, [preferSimpleSpellings, selectedNote, selectedScaleType])



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
                            mt: 0.5,
                            fontSize: { xs: "1.8rem", md: "2.2rem" },
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: "0.01em",
                        }}
                    >
                        {formatNote(scale.tonic)}
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
                        {scale.type.name}
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
                        <NoteWheel selectedScale={scale} size={420} />
                        <CircleOfFifths selectedScale={scale} size={420} showChords />
                    </Box>
                    <Typography>
                        {scale.harmony?.sevenths.map((chord) => {
                            return chord.symbol
                        })}
                    </Typography>

                    <Typography>
                        {scale.harmony?.triads.map((chord) => {
                            return chord.symbol
                        })}
                    </Typography>

                    <Typography>
                        {scale.derivedChords?.byKind.c6?.map((chord) => {
                            return chord?.symbol
                        })}
                    </Typography>
                    <Typography>
                        {scale.derivedChords?.byKind.c5?.map((chord) => {
                            return chord?.symbol
                        })}
                    </Typography>
                    <Typography>
                        {scale.derivedChords?.byKind.sus2?.map((chord) => {
                            return chord?.symbol
                        })}
                    </Typography>
                    <Typography>
                        {scale.derivedChords?.byKind.sus4?.map((chord) => {
                            return chord?.symbol
                        })}
                    </Typography>
                    <Typography>
                        {scale.derivedChords?.byKind.add9?.map((chord) => {
                            return chord?.symbol
                        })}
                    </Typography>


                </Box>
            </Stack>
        </Box>
    );
}
