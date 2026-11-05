import {createRootRouteWithContext, HeadContent, Outlet} from "@tanstack/react-router";
import {z} from 'zod';


const rootSearchSchema = z.object({
    error: z.string().optional(),
    error_description: z.string().optional(),
}).passthrough();

export const Route = createRootRouteWithContext()({
    validateSearch: rootSearchSchema,
    component: RootComponent,
    head: () => ({
        meta: [{ title: 'Music helper' }],
    }),
})

// eslint-disable-next-line react-refresh/only-export-components
function RootComponent() {
    return (
        <div>
            <HeadContent/>
            <Outlet/>
        </div>
    )
}
