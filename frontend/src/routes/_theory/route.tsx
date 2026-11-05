import {createFileRoute, Outlet} from "@tanstack/react-router";
import {useEffect} from "react";
import AppHeader, {type AppHeaderNavItem} from "../../components/AppHeader.tsx";
import {warmupAudio} from "../../features/theory/audio/soundfont.ts";
import {TheoryHeaderActions} from "../../features/theory/TheoryHeaderActions.tsx";

const NAV_ITEMS: AppHeaderNavItem[] = [
    { label: "Scales", to: "/scales" },
    { label: "Chords", to: "/chords" },
    { label: "Practice", to: "/practice" },
]

// Pathless layout for the theory pages (/scales, /chords).
export const Route = createFileRoute("/_theory")({
    component: TheoryLayout,
})

// eslint-disable-next-line react-refresh/only-export-components
function TheoryLayout() {

    useEffect(() => {
        const handleWarmup = () => {
            void warmupAudio();
            window.removeEventListener("pointerdown", handleWarmup);
            window.removeEventListener("keydown", handleWarmup);
            window.removeEventListener("touchstart", handleWarmup);
        };

        window.addEventListener("pointerdown", handleWarmup, { once: true });
        window.addEventListener("keydown", handleWarmup, { once: true });
        window.addEventListener("touchstart", handleWarmup, { once: true });

        return () => {
            window.removeEventListener("pointerdown", handleWarmup);
            window.removeEventListener("keydown", handleWarmup);
            window.removeEventListener("touchstart", handleWarmup);
        };
    }, []);

    return (
        <>
            <AppHeader homeTo="/scales" navItems={NAV_ITEMS} actions={<TheoryHeaderActions/>}/>
            <Outlet/>
        </>
    )
}
