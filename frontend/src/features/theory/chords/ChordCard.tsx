import type {Chord} from "musiclib"
import { CSS } from "@dnd-kit/utilities";
import {NOTE_DISPLAY_TEXT_SX, useNoteFormatter} from "../utils/noteDisplay.ts";
import { useSortable } from "@dnd-kit/sortable";
import {Box, Card, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import {ChordPiano} from "../scales/ChordPiano.tsx";
import {usePreferSimpleSpellings} from "../utils/preferences.ts";
import {getDisplayChord} from "../utils/chordDisplay.ts";

type ChordCardProps = {
    uid: string;
    displayChord: Chord;
    isCurrentlyPlaying: boolean;
    onChangeInversion: (direction: -1 | 1) => void;
    onPlay: () => void;
    onRemove: () => void;
}

export function ChordCard({
    uid,
    displayChord,
    isCurrentlyPlaying,
    onChangeInversion,
    onPlay,
    onRemove,
} : ChordCardProps) {
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const { formatText } = useNoteFormatter();
    const displayChordForRender = getDisplayChord(displayChord, preferSimpleSpellings);
    const maxInversion = Math.max(displayChord.notes.length - 1, 0);
    const disableInvertDown = (displayChord.inversion ?? 0) <= 0;
    const disableInvertUp = (displayChord.inversion ?? 0) >= maxInversion;
    const inversionLabel = displayChord.inversion && displayChord.inversion > 0
        ? `${displayChord.inversion}${displayChord.inversion === 1 ? "st" : displayChord.inversion === 2 ? "nd" : displayChord.inversion === 3 ? "rd" : "th"} inversion`
        : "Root position";
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: uid });

    return (
        <Card
            ref={setNodeRef}
            sx={{
                border: "2px solid",
                borderColor: isCurrentlyPlaying ? "secondary.main" : "divider",
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.72 : 1,
                boxShadow: isDragging
                    ? 6
                    : isCurrentlyPlaying
                        ? (theme) => `0 0 0 4px ${theme.palette.secondary.main}22`
                        : "none",
                borderStyle: isDragging ? "dashed" : "solid",
            }}
        >
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>

                <Box sx={{ p: 2 }}>
                    <Stack spacing={1.75}>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "32px minmax(0, 1fr) 32px",
                                gap: 1.5,
                                alignItems: "start",
                            }}
                        >
                            <Box
                                sx={{
                                    position: "relative",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "flex-start",
                                }}
                            >
                                <IconButton
                                    color="secondary"
                                    onClick={onPlay}
                                    sx={{
                                        mt: -0.5,
                                        ml: -0.5,
                                        "& .MuiSvgIcon-root": {
                                            fontSize: 28,
                                        },
                                    }}
                                >
                                    <PlayArrowRoundedIcon />
                                </IconButton>

                                <IconButton
                                    size="large"
                                    {...attributes}
                                    {...listeners}
                                    sx={{
                                        position: "absolute",
                                        top: "50%",
                                        left: "50%",
                                        transform: "translate(-50%, 150%)",
                                        cursor: isDragging ? "grabbing" : "grab",
                                        touchAction: "none",
                                        color: "text.secondary",
                                        "& .MuiSvgIcon-root": {
                                            fontSize: 34,
                                        },
                                    }}
                                >
                                    <DragIndicatorRoundedIcon color="action" />
                                </IconButton>
                            </Box>

                            <Box sx={{ minWidth: 0, textAlign: "center", pt: 0.25 }}>
                                <Typography variant="h4" sx={{ ...NOTE_DISPLAY_TEXT_SX, fontWeight: 700, lineHeight: 1.1 }}>
                                    {formatText(displayChordForRender.symbol)}
                                </Typography>
                            </Box>

                            <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-start", minWidth: 0 }}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                    <Chip
                                        color="secondary"
                                        label="Playing"
                                        size="small"
                                        sx={{
                                            visibility: isCurrentlyPlaying ? "visible" : "hidden",
                                            pointerEvents: "none",
                                        }}
                                    />
                                    <IconButton size="small" color="error" onClick={onRemove} sx={{ mt: -0.5, mr: -0.5 }}>
                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Stack>
                            </Box>
                        </Box>

                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" flexWrap="wrap" useFlexGap>
                            <>
                                <IconButton size="small" onClick={() => onChangeInversion(-1)} disabled={disableInvertDown}>
                                    <RemoveRoundedIcon />
                                </IconButton>
                                <Chip label={inversionLabel} />
                                <IconButton size="small" onClick={() => onChangeInversion(1)} disabled={disableInvertUp}>
                                    <AddRoundedIcon />
                                </IconButton>
                            </>
                        </Stack>

                        <Box
                            sx={{
                                px: { xs: 1, sm: 2 },
                                marginTop: -3
                            }}
                        >
                            <ChordPiano selectedChord={displayChordForRender} showKeyNames />
                        </Box>
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    )
}
