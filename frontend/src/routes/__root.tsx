import {createRootRouteWithContext, Outlet, redirect, useRouterState} from "@tanstack/react-router";
import { useEffect } from "react";
import {z} from 'zod';
import NavHeader from "../components/NavHeader.tsx";
import { warmupAudio } from "../audio/soundfont.ts";


const rootSearchSchema = z.object({
    error: z.string().optional(),
    error_description: z.string().optional(),
}).passthrough();

export const Route = createRootRouteWithContext()({
    validateSearch: rootSearchSchema,
    component: RootComponent,
    beforeLoad: ({location}) => {
        if (location.pathname === '/') {
            throw redirect({
                to: '/scales',
                replace: true
            });
        }
    },
    staticData: {
        showNav: false,
        title: 'Music helper',
    }
})

// eslint-disable-next-line react-refresh/only-export-components
function RootComponent() {

    const state = useRouterState();
    const showNav = state.matches.some((match) => {
        return match.staticData?.showNav;
    });

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
        <div>
           {showNav && (<NavHeader/>)}
            <Outlet/>
       </div>
    )
}
