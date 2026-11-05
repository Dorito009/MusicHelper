import {createFileRoute} from "@tanstack/react-router";
import {Container, Typography} from "@mui/material";

export const Route = createFileRoute("/practice/settings")({
    component: SettingsPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice settings' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function SettingsPage() {
    return <Container sx={{py: 3}}><Typography>Practice settings: coming soon.</Typography></Container>
}
