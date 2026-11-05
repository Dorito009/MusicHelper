import type {KeyboardEvent as ReactKeyboardEvent} from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import {
    Box,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import {type Chord, type Note} from "musiclib";
import {ChordPiano} from "../scales/ChordPiano.tsx";
import {NOTE_DISPLAY_TEXT_SX, useNoteFormatter} from "../utils/noteDisplay.ts";
import {usePreferSimpleSpellings} from "../utils/preferences.ts";
import {getDisplayChord} from "../utils/chordDisplay.ts";

export type ChordHelperDialogEntry = {
    uid: string;
    chord: Chord;
};

type ChordHelperDialogProps = {
    open: boolean;
    entries: ChordHelperDialogEntry[];
    selectedUid: string | null;
    currentlyPlayingUid: string | null;
    onClose: () => void;
    onSelectUid: (uid: string) => void;
};

function getInversionLabel(inversion: number = 0): string {
    if (inversion <= 0) {
        return "Root position";
    }

    return `${inversion}${inversion === 1 ? "st" : inversion === 2 ? "nd" : inversion === 3 ? "rd" : "th"} inversion`;
}

type NavCardProps = {
    label: string;
    direction: "previous" | "next";
    entry?: ChordHelperDialogEntry;
    onClick: () => void;
};

function renderNoteList(notes: Note[], formatNote: (note: Note) => string) {
    return notes.map((note, index) => (
        <Box component="span" key={`${note.pitch}-${index}`}>
            {index > 0 ? <Box component="span"> - </Box> : null}
            <Box component="span" sx={NOTE_DISPLAY_TEXT_SX}>{formatNote(note)}</Box>
        </Box>
    ));
}

function NavCard({label, direction, entry, onClick}: NavCardProps) {
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const {formatNote, formatText} = useNoteFormatter();
    const isClickable = Boolean(entry);
    const displayChord = entry ? getDisplayChord(entry.chord, preferSimpleSpellings) : undefined;
    const arrow = direction === "previous"
        ? <KeyboardArrowLeftRoundedIcon sx={{color: "text.secondary", fontSize: 28}} />
        : <KeyboardArrowRightRoundedIcon sx={{color: "text.secondary", fontSize: 28}} />;

    return (
        <Card
            variant="outlined"
            onClick={entry ? onClick : undefined}
            sx={{
                flex: 1,
                minHeight: 132,
                cursor: isClickable ? "pointer" : "default",
                opacity: isClickable ? 1 : 0.58,
                transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                '&:hover': isClickable
                    ? {
                        borderColor: "secondary.main",
                        transform: "translateY(-1px)",
                        boxShadow: 3,
                    }
                    : undefined,
            }}
        >
            <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                    {direction === "previous" ? arrow : null}
                    <Box sx={{minWidth: 0, flex: 1}}>
                        <Typography variant="overline" sx={{color: "text.secondary", letterSpacing: "0.12em"}}>
                            {label}
                        </Typography>
                        <Typography variant="h6" sx={{...NOTE_DISPLAY_TEXT_SX, fontWeight: 700}}>
                            {displayChord ? formatText(displayChord.symbol) : "-"}
                        </Typography>
                        <Typography sx={{color: "text.secondary"}}>
                            {displayChord ? renderNoteList(displayChord.notes, formatNote) : `No ${label.toLowerCase()} chord`}
                        </Typography>
                    </Box>
                    {direction === "next" ? arrow : null}
                </Stack>
            </CardContent>
        </Card>
    );
}

export function ChordHelperDialog({
    open,
    entries,
    selectedUid,
    currentlyPlayingUid,
    onClose,
    onSelectUid,
}: ChordHelperDialogProps) {
    const [preferSimpleSpellings] = usePreferSimpleSpellings();
    const {formatNote, formatText} = useNoteFormatter();
    const currentIndex = entries.findIndex((entry) => entry.uid === selectedUid);
    const currentEntry = currentIndex === -1 ? undefined : entries[currentIndex];
    const previousEntry = currentIndex > 0 ? entries[currentIndex - 1] : undefined;
    const nextEntry = currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1] : undefined;

    if (!open || !currentEntry) {
        return null;
    }

    const isCurrentPlaying = currentlyPlayingUid === currentEntry.uid;
    const displayCurrentChord = getDisplayChord(currentEntry.chord, preferSimpleSpellings);

    const handleKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === "ArrowLeft" && previousEntry) {
            event.preventDefault();
            onSelectUid(previousEntry.uid);
        }

        if (event.key === "ArrowRight" && nextEntry) {
            event.preventDefault();
            onSelectUid(nextEntry.uid);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} onKeyDown={handleKeyDown} maxWidth="md" fullWidth>
            <DialogTitle sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2}}>
                <Stack spacing={0.25}>
                    <Typography variant="overline" sx={{color: "text.secondary", letterSpacing: "0.14em"}}>
                        Chord helper
                    </Typography>
                    <Typography variant="h5" sx={{fontWeight: 700}}>Move through your chord set</Typography>
                </Stack>
                <IconButton onClick={onClose} aria-label="close chord helper">
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={2.5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        <Chip label={`Chord ${currentIndex + 1} / ${entries.length}`} />
                        <Chip label={getInversionLabel(currentEntry.chord.inversion ?? 0)} />
                        {isCurrentPlaying ? <Chip color="secondary" label="Playing" /> : null}
                    </Stack>

                    <Stack direction={{xs: "column", md: "row"}} spacing={1.5}>
                        <NavCard
                            label="Previous"
                            direction="previous"
                            entry={previousEntry}
                            onClick={() => previousEntry && onSelectUid(previousEntry.uid)}
                        />

                        <Card
                            variant="outlined"
                            sx={{
                                flex: 1.4,
                                borderWidth: 2,
                                borderColor: isCurrentPlaying ? "secondary.main" : "divider",
                                boxShadow: isCurrentPlaying ? (theme) => `0 0 0 4px ${theme.palette.secondary.main}22` : "none",
                            }}
                        >
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Typography variant="overline" sx={{color: "text.secondary", letterSpacing: "0.12em"}}>
                                        Current
                                    </Typography>
                                    <Typography variant="h4" sx={{...NOTE_DISPLAY_TEXT_SX, fontWeight: 700}}>
                                        {formatText(displayCurrentChord.symbol)}
                                    </Typography>
                                    <Typography sx={{color: "text.secondary"}}>
                                        {renderNoteList(displayCurrentChord.notes, formatNote)}
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>

                        <NavCard
                            label="Next"
                            direction="next"
                            entry={nextEntry}
                            onClick={() => nextEntry && onSelectUid(nextEntry.uid)}
                        />
                    </Stack>

                    <ChordPiano selectedChord={displayCurrentChord} showKeyNames />
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
