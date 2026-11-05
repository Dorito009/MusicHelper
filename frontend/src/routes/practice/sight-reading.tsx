import {createFileRoute} from "@tanstack/react-router";
import {SightReadingPage} from "../../features/practice/sightreading/SightReadingPage.tsx";

export const Route = createFileRoute("/practice/sight-reading")({
    component: SightReadingPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Sight-reading' }],
    }),
})
