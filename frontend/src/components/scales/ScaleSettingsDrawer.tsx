import {
    Box,
    Checkbox,
    Chip,
    Divider,
    Drawer,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    IconButton,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {noteRows, formatNote, getAllScaleTypes} from "musiclib"
import type {Note, ScaleType} from "musiclib"
import { type ChordVisibilityKey, useChordVisibilityPreferences } from "../../utils/preferences.ts";

export const SCALE_DRAWER_WIDTH = 260;

const chordVisibilityOptions: Array<{ key: ChordVisibilityKey; label: string }> = [
    { key: "sus2", label: "Sus2" },
    { key: "triads", label: "Triad" },
    { key: "sus4", label: "Sus4" },
    { key: "sevenths", label: "7" },
    { key: "fifths", label: "5" },
    { key: "sixths", label: "6" },
    { key: "add9", label: "9" },
];

type ScaleSettingsDrawerProps = {
    open: boolean;
    onClose: () => void;

    selectedNote: Note;
    onSelectNote: (Note: Note) => void;

    selectedScaleType: ScaleType
    onSelectScaleType: (ScaleType: ScaleType) => void;
};

export function ScaleSettingsDrawer({
                                        open,
                                        onClose,
                                        selectedNote,
                                        onSelectNote,
                                        selectedScaleType,
                                        onSelectScaleType
                                     }: ScaleSettingsDrawerProps) {
    const theme = useTheme();
    const [chordVisibility, , setChordVisibility] = useChordVisibilityPreferences();

    const drawerInner = (
        <Box
            sx={{
                height: "100%",
                px: 1,
                py: 1.5,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <IconButton onClick={onClose} size="small" aria-label="close settings">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr",
                    columnGap: 1.25,
                    alignItems: "start",
                    minHeight: 0,
                }}
            >
                {/* Notes column */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4, textAlign: "center" }}
                    >
                        Note
                    </Typography>

                    <Box sx={{ display: "grid", gap: 0.75 }}>
                        {noteRows.map((notes, rowIndex) => (
                            <Box
                                key={`note-row-${rowIndex}`}
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: 0.75,
                                    justifyItems: "center",
                                }}
                            >
                                {notes.map((note, noteIndexInRow) => {
                                    if (!note) {
                                        return <Box key={`empty-${rowIndex}-${noteIndexInRow}`} sx={{ width: 34, height: 34 }} />;
                                    }

                                    const isSelectedNote = selectedNote.letter === note.letter && selectedNote.alter === note.alter;

                                    return (
                                        <Chip
                                            key={formatNote(note)}
                                            label={formatNote(note, { accidental: "ascii" })}
                                            clickable
                                            size="small"
                                            onClick={() => onSelectNote(note)}
                                            color={isSelectedNote ? "secondary" : "default"}
                                            variant={isSelectedNote ? "filled" : "outlined"}
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: "50%",
                                                "& .MuiChip-label": {
                                                    px: 0,
                                                    fontSize: "0.78rem",
                                                    fontWeight: 600,
                                                },
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Divider + scales column */}
                <Box
                    sx={{
                        borderLeft: `1px solid ${theme.palette.divider}`,
                        pl: 1.25,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.75,
                        minWidth: 0,
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4, textAlign: "center" }}
                    >
                        Scale
                    </Typography>
                    <Box sx={{ display: "grid", gap: 0.75 }}>
                        {getAllScaleTypes().map((scale) => (
                            <Tooltip key={scale.id} title={scale.name} placement="right">
                                <Chip
                                    label={scale.shortName}
                                    clickable
                                    size="small"
                                    onClick={() => onSelectScaleType(scale)}
                                    color={selectedScaleType.id === scale.id ? "secondary" : "default"}
                                    variant={selectedScaleType.id === scale.id ? "filled" : "outlined"}
                                    sx={{
                                        justifyContent: "flex-start",
                                        width: "100%",
                                        height: 34,
                                        borderRadius: 999,
                                        "& .MuiChip-label": {
                                            px: 1,
                                            width: "100%",
                                            textAlign: "center",
                                            fontSize: "0.72rem",
                                            fontWeight: 600,
                                        },
                                    }}
                                />
                            </Tooltip>
                        ))}
                    </Box>
                </Box>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <FormControl component="fieldset" variant="standard">
                <FormLabel component="legend">Scale chord groups</FormLabel>
                <FormGroup>
                    {chordVisibilityOptions.map((option) => (
                        <FormControlLabel
                            key={option.key}
                            control={
                                <Checkbox
                                    checked={chordVisibility[option.key]}
                                    onChange={(_, checked) => setChordVisibility(option.key, checked)}
                                />
                            }
                            label={option.label}
                        />
                    ))}
                </FormGroup>
            </FormControl>
        </Box>
    );

    return (
        <Drawer
            variant="temporary"
            open={open}
            onClose={onClose}
            ModalProps={{ keepMounted: true }}
            sx={{
                width: SCALE_DRAWER_WIDTH,
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                    width: SCALE_DRAWER_WIDTH,
                    boxSizing: "border-box",
                    overflowX: "hidden",
                    borderRight: `1px solid ${theme.palette.divider}`,
                    bgcolor: "background.paper",
                },
            }}
        >
            {drawerInner}
        </Drawer>
    );
}
