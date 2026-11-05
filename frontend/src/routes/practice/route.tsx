import {createFileRoute, Outlet} from "@tanstack/react-router";
import AppHeader, {type AppHeaderNavItem} from "../../components/AppHeader.tsx";

// Theory pages are kept out of the way here: one collapsed "Theory" menu.
const NAV_ITEMS: AppHeaderNavItem[] = [
    { label: "Library", to: "/practice" },
    { label: "Sight-reading", to: "/practice/sight-reading" },
    { label: "Settings", to: "/practice/settings" },
    {
        label: "Theory",
        items: [
            { label: "Scales", to: "/scales" },
            { label: "Chords", to: "/chords" },
        ],
    },
]

// Layout for the practice section (/practice/*).
export const Route = createFileRoute("/practice")({
    component: PracticeLayout,
})

// eslint-disable-next-line react-refresh/only-export-components
function PracticeLayout() {
    return (
        <>
            <AppHeader homeTo="/practice" navItems={NAV_ITEMS}/>
            <Outlet/>
        </>
    )
}
