import {createFileRoute} from "@tanstack/react-router";
import {Box, Typography} from "@mui/material";

export const Route = createFileRoute("/practice/")({
    component: PracticeIndexPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function PracticeIndexPage() {
    return (
        <Box sx={{ px: 2, py: 6, textAlign: 'center' }}>
            <Typography variant="h4">Practice: coming soon</Typography>
        </Box>
    )
}
