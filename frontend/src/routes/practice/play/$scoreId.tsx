import {createFileRoute} from "@tanstack/react-router";
import {useLiveQuery} from "dexie-react-hooks";
import {Alert, Container} from "@mui/material";
import {practiceDb} from "../../../features/practice/storage/db.ts";
import {updateScoreConfig} from "../../../features/practice/storage/scores.ts";
import {PracticePlayer} from "../../../features/practice/player/PracticePlayer.tsx";
import {LinkButton} from "../../../features/practice/ui/RouterLinks.tsx";

export const Route = createFileRoute("/practice/play/$scoreId")({
    component: PlayPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice a score' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function PlayPage() {
    const {scoreId} = Route.useParams()
    // null = not found, undefined = still loading.
    const score = useLiveQuery(async () => (await practiceDb.scores.get(scoreId)) ?? null, [scoreId])

    return (
        <Container maxWidth="xl" sx={{py: 2}}>
            {score === null && (
                <Alert severity="warning" action={<LinkButton to="/practice" color="inherit">Back to the library</LinkButton>}>
                    This score isn't in your library. It may have been deleted.
                </Alert>
            )}
            {score && (
                <PracticePlayer
                    scoreId={score.id}
                    title={score.title}
                    xml={score.xml}
                    config={score.config}
                    onConfigChange={(config) => void updateScoreConfig(score.id, config)}
                />
            )}
        </Container>
    )
}
