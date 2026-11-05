import {createFileRoute} from "@tanstack/react-router";
import {LibraryPage} from "../../features/practice/library/LibraryPage.tsx";

export const Route = createFileRoute("/practice/")({
    component: LibraryPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice' }],
    }),
})
