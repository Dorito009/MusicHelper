import {
    Box,
    Chip,
    Drawer,
    IconButton,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { NOTES_DISPLAY, SCALES } from "../../utils/musicUtils.ts";

export const SCALE_DRAWER_WIDTH = 224;

const NOTE_ROWS = [
    ["C", "C♯"],
    ["D", "D♯"],
    ["E", null],
    ["F", "F♯"],
    ["G", "G♯"],
    ["A", "A♯"],
    ["B", null],
] as const;

type ScaleSettingsDrawerProps = {
    open: boolean;
    onClose: () => void;
    selectedNote: number;
    selectedScale: number;
    onSelectNote: (index: number) => void;
    onSelectScale: (index: number) => void;
};

const SCALE_SHORT_LABELS: Record<string, string> = {
    Major: "Maj",
    Minor: "Min",
    Dorian: "Dor",
    Phrygian: "Phr",
    Lydian: "Lyd",
    Mixolydian: "Mix",
    Aeolian: "Aeo",
    Locrian: "Loc",
    "Harmonic Minor": "Har",
    "Melodic Minor": "Mel",
};

function shortScaleLabel(scale: string) {
    return SCALE_SHORT_LABELS[scale] ?? scale.slice(0, 3);
}

function noteIndex(note: string) {
    return NOTES_DISPLAY.indexOf(note);
}

export function ScaleSettingsDrawer({
                                        open,
                                        onClose,
                                        selectedNote,
                                        selectedScale,
                                        onSelectNote,
                                        onSelectScale,
                                     }: ScaleSettingsDrawerProps) {
    const theme = useTheme();

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
                    gridTemplateColumns: "88px 1fr",
                    columnGap: 1.25,
                    alignItems: "start",
                    flex: 1,
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
                        {NOTE_ROWS.map(([leftNote, rightNote]) => (
                            <Box
                                key={leftNote}
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(2, 1fr)",
                                    gap: 0.75,
                                    justifyItems: "center",
                                }}
                            >
                                {[leftNote, rightNote].map((note) => {
                                    if (!note) {
                                        return <Box key={`${leftNote}-empty`} sx={{ width: 34, height: 34 }} />;
                                    }

                                    const index = noteIndex(note);

                                    return (
                                        <Chip
                                            key={note}
                                            label={note}
                                            clickable
                                            size="small"
                                            onClick={() => onSelectNote(index)}
                                            color={selectedNote === index ? "secondary" : "default"}
                                            variant={selectedNote === index ? "filled" : "outlined"}
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
                        {SCALES.map((scale, index) => (
                            <Tooltip key={scale} title={scale} placement="right">
                                <Chip
                                    label={shortScaleLabel(scale)}
                                    clickable
                                    size="small"
                                    onClick={() => onSelectScale(index)}
                                    color={selectedScale === index ? "secondary" : "default"}
                                    variant={selectedScale === index ? "filled" : "outlined"}
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
