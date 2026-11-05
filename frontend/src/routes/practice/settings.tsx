import {createFileRoute} from "@tanstack/react-router";
import {SettingsPage} from "../../features/practice/settings/SettingsPage.tsx";

export const Route = createFileRoute("/practice/settings")({
    component: SettingsPage,
    head: () => ({
        meta: [{ title: 'Music Helper | Practice settings' }],
    }),
})
