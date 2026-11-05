import {createFileRoute} from "@tanstack/react-router";
import {Container, Typography} from "@mui/material";

export const Route = createFileRoute("/practice/sight-reading")({
    component: SightReadingPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Sight-reading' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function SightReadingPage() {
    return <Container sx={{py: 3}}><Typography>Sight-reading: coming soon.</Typography></Container>
}
