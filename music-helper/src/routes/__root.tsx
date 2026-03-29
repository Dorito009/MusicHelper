import {createRootRouteWithContext, Outlet, redirect, useRouterState} from "@tanstack/react-router";
import {z} from 'zod';
import NavHeader from "../components/NavHeader.tsx";


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

    return (
        <div>
           {showNav && (<NavHeader/>)}
            <Outlet/>
       </div>
    )
}
