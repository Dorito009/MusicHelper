import { createFileRoute } from '@tanstack/react-router'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Box, Card, CardContent, Fab, IconButton, Stack, Typography} from "@mui/material"
import {alpha} from "@mui/material/styles";
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {Chord} from "musiclib"
import AddIcon from '@mui/icons-material/Add';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ViewCarouselRoundedIcon from '@mui/icons-material/ViewCarouselRounded';
import {normalizeInstrumentName, playChord} from "../features/theory/audio/soundfont.ts";
import {ChordDialog} from "../features/theory/chords/ChordDialog.tsx";
import {ChordCard} from "../features/theory/chords/ChordCard.tsx";
import {ChordHelperDialog} from "../features/theory/chords/ChordHelperDialog.tsx";
import {useSavedChords} from "../features/theory/utils/ChordPageUtils.ts";
import {useInstrument} from "../features/theory/utils/preferences.ts";

export const Route = createFileRoute('/chords')({
    component: ChordsPage,
    staticData: {
        title: "Music Helper | Chords",
        showNav: true,
    },
})

const CHORD_SET_KEY = "music-helper:chord-set";
const CHORD_CARD_CONTAINER_MAX_WIDTH = 860;
const CHORD_PLAY_DURATION_SECONDS = 1.1;
const CHORD_SINGLE_RESET_DELAY_MS = 1200;
const CHORD_PLAY_ALL_STEP_DELAY_MS = 850;
const FLOATING_ACTION_BUTTON_SX = {
    width: 54,
    height: 54,
    minHeight: 54,
    backgroundColor: (theme: { palette: { text: { primary: string } } }) => alpha(theme.palette.text.primary, 0.05),
    color: "text.primary",
    backdropFilter: "blur(10px)",
    boxShadow: 6,
    '&:hover': {
        backgroundColor: (theme: { palette: { text: { primary: string } } }) => alpha(theme.palette.text.primary, 0.1),
    },
    '&.Mui-disabled': {
        backgroundColor: (theme: { palette: { text: { primary: string } } }) => alpha(theme.palette.text.primary, 0.03),
        color: (theme: { palette: { text: { primary: string } } }) => alpha(theme.palette.text.primary, 0.45),
    },
};

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

// eslint-disable-next-line react-refresh/only-export-components
function ChordsPage() {
    const [chordDialogIsOpen, setChordDialogIsOpen] = useState(false);
    const [helperUid, setHelperUid] = useState<string | null>(null);
    const [currentlyPlayingUid, setCurrentlyPlayingUid] = useState<string | null>(null);
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [instrument] = useInstrument();
    const playTimeoutRef = useRef<number | null>(null);
    const playbackSessionRef = useRef(0);
    const selectedInstrument = useMemo(() => normalizeInstrumentName(instrument), [instrument]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const {
        chordEntries,
        addChord,
        removeChord,
        reorderChords,
        invertChord,
    } = useSavedChords(CHORD_SET_KEY);

    const helperOpen = helperUid !== null && chordEntries.some((entry) => entry.uid === helperUid);

    const clearPlayTimeout = useCallback(() => {
        if (playTimeoutRef.current !== null) {
            window.clearTimeout(playTimeoutRef.current);
            playTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            playbackSessionRef.current += 1;
            clearPlayTimeout();
        };
    }, [clearPlayTimeout]);

    const onChordAdded = useCallback((chord: Chord) => {
        setChordDialogIsOpen(false);
        addChord(chord)
    }, [addChord]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;

        if (!over || active.id === over.id) {
            return;
        }

        reorderChords(String(active.id), String(over.id));
    }, [reorderChords]);

    const playSelectedChord = useCallback((uid: string, chord: Chord) => {
        playbackSessionRef.current += 1;
        const sessionId = playbackSessionRef.current;

        clearPlayTimeout();
        setIsPlayingAll(false);

        setCurrentlyPlayingUid(uid);
        playTimeoutRef.current = window.setTimeout(() => {
            if (playbackSessionRef.current === sessionId) {
                setCurrentlyPlayingUid((currentUid) => currentUid === uid ? null : currentUid);
            }

            playTimeoutRef.current = null;
        }, CHORD_SINGLE_RESET_DELAY_MS);

        void playChord(chord, CHORD_PLAY_DURATION_SECONDS, selectedInstrument);
    }, [clearPlayTimeout, selectedInstrument]);

    const playAllChords = useCallback(async () => {
        if (chordEntries.length === 0 || isPlayingAll) {
            return;
        }

        clearPlayTimeout();

        const sessionId = playbackSessionRef.current + 1;
        playbackSessionRef.current = sessionId;
        setIsPlayingAll(true);

        try {
            for (const entry of chordEntries) {
                if (playbackSessionRef.current !== sessionId) {
                    return;
                }

                setCurrentlyPlayingUid(entry.uid);
                await playChord(entry.chord, CHORD_PLAY_DURATION_SECONDS, selectedInstrument);

                if (playbackSessionRef.current !== sessionId) {
                    return;
                }

                await wait(CHORD_PLAY_ALL_STEP_DELAY_MS);
            }
        } finally {
            if (playbackSessionRef.current === sessionId) {
                setCurrentlyPlayingUid(null);
                setIsPlayingAll(false);
            }
        }
    }, [chordEntries, clearPlayTimeout, isPlayingAll, selectedInstrument]);

    const openChordHelper = useCallback(() => {
        if (chordEntries.length === 0) {
            return;
        }

        const initialUid = currentlyPlayingUid && chordEntries.some((entry) => entry.uid === currentlyPlayingUid)
            ? currentlyPlayingUid
            : chordEntries[0].uid;

        setHelperUid(initialUid);
    }, [chordEntries, currentlyPlayingUid]);

    return (
        <Box sx={{display: "flex", justifyContent: "center", px: {xs: 2, md: 3}, pt: {xs: 2, md: 3}, pb: {xs: 12, md: 14}}}>
            <Stack spacing={2.5} sx={{alignItems: "center", width: "100%", maxWidth: CHORD_CARD_CONTAINER_MAX_WIDTH}}>
                {chordEntries.length === 0 ? (
                    <Card variant="outlined" sx={{width: "100%"}}>
                        <CardContent>
                            <Typography variant="h6" sx={{fontWeight: 700}}>No chords yet</Typography>
                            <Typography sx={{color: "text.secondary", mt: 0.5}}>
                                Add a chord to build your list, then drag cards to reorder them.
                            </Typography>
                        </CardContent>
                    </Card>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={chordEntries.map((entry) => entry.uid)} strategy={verticalListSortingStrategy}>
                            <Stack spacing={2.5} sx={{width: "100%"}}>
                                {chordEntries.map((entry, index) => (
                                    <ChordCard
                                        key={entry.uid}
                                        uid={entry.uid}
                                        displayChord={entry.chord}
                                        onChangeInversion={(direction) => invertChord(index, direction)}
                                        isCurrentlyPlaying={currentlyPlayingUid === entry.uid}
                                        onPlay={() => playSelectedChord(entry.uid, entry.chord)}
                                        onRemove={() => removeChord(index)}
                                    />
                                ))}
                            </Stack>
                        </SortableContext>
                    </DndContext>
                )}

                <Box>
                    <IconButton
                        onClick={() => {setChordDialogIsOpen(true)}}
                        sx={{
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '50%',
                            width: 64,
                            height: 64,
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            },
                            marginTop: 2,
                        }}
                    >
                        <AddIcon />
                    </IconButton>
                </Box>

                <ChordDialog
                    open={chordDialogIsOpen}
                    onClose={() => setChordDialogIsOpen(false)}
                    onSubmit={onChordAdded}
                />

                <ChordHelperDialog
                    open={helperOpen}
                    entries={chordEntries}
                    selectedUid={helperUid}
                    currentlyPlayingUid={currentlyPlayingUid}
                    onClose={() => setHelperUid(null)}
                    onSelectUid={setHelperUid}
                />
            </Stack>

            <Box
                sx={{
                    position: "fixed",
                    right: {xs: 16, md: 24},
                    bottom: {xs: 16, md: 24},
                    zIndex: (theme) => theme.zIndex.appBar - 1,
                }}
            >
                <Stack direction="row" spacing={1}>
                    <Fab
                        aria-label="open chord helper"
                        onClick={openChordHelper}
                        disabled={chordEntries.length === 0}
                        sx={FLOATING_ACTION_BUTTON_SX}
                    >
                        <ViewCarouselRoundedIcon sx={{fontSize: 26}} />
                    </Fab>

                    <Fab
                        aria-label="play all chords"
                        onClick={() => { void playAllChords(); }}
                        disabled={chordEntries.length === 0 || isPlayingAll}
                        sx={FLOATING_ACTION_BUTTON_SX}
                    >
                        <PlayArrowRoundedIcon sx={{fontSize: 30}} />
                    </Fab>
                </Stack>
            </Box>
        </Box>
    )

}
