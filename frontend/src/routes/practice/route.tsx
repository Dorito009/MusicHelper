import {createFileRoute, Outlet} from "@tanstack/react-router";

// Layout for the practice section (/practice/*).
export const Route = createFileRoute("/practice")({
    component: PracticeLayout,
})

// eslint-disable-next-line react-refresh/only-export-components
function PracticeLayout() {
    return <Outlet/>
}
