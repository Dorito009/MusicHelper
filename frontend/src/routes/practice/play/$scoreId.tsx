import {createFileRoute} from "@tanstack/react-router";
import {Container, Typography} from "@mui/material";

export const Route = createFileRoute("/practice/play/$scoreId")({
    component: PlayPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice a score' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function PlayPage() {
    const {scoreId} = Route.useParams()
    return <Container sx={{py: 3}}><Typography>Player for {scoreId}: coming in the next milestone.</Typography></Container>
}
