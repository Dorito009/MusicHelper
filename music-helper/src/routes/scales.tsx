import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
    Box,
    IconButton,
    Stack,
    Typography,
} from "@mui/material";
import { NOTES_DISPLAY, SCALES } from "../utils/musicUtils.ts";
import { ScaleSettingsDrawer } from "../components/scales/ScaleSettingsDrawer.tsx";

export const Route = createFileRoute("/scales")({
    component: ScalePage,
    staticData: {
        title: "Music Helper | Scales",
        showNav: true,
    },
});

function ScalePage() {
    const [selectedNote, setSelectedNote] = React.useState(0);
    const [selectedScale, setSelectedScale] = React.useState(0);
    const [isScaleDrawerOpen, setIsScaleDrawerOpen] = React.useState(false);

    const selectedNoteLabel = NOTES_DISPLAY[selectedNote];
    const selectedScaleLabel = SCALES[selectedScale];

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
                selectedScale={selectedScale}
                onSelectNote={setSelectedNote}
                onSelectScale={setSelectedScale}
            />

            <Stack spacing={2} sx={{ width: "100%", maxWidth: 420, alignItems: "center", textAlign: "center" }}>
                <Box>
                    <Typography variant="overline" color="text.secondary">
                        Selected Scale
                    </Typography>
                    <Typography variant="h4">
                        {selectedNoteLabel} {selectedScaleLabel}
                    </Typography>
                </Box>
            </Stack>
        </Box>
    );
}
