import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import {NotFoundComponent} from "./components/404.tsx";
import {ErrorComponent} from "./components/Error.tsx";

const basepath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

// Create constant router instance
export const router = createRouter({
    routeTree,
    basepath,
    defaultPreload: false,
    defaultNotFoundComponent: NotFoundComponent,
    defaultErrorComponent: ErrorComponent,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router;
    }
    interface StaticDataRouteOption {
        showNav: boolean,
        title: string,
    }
}
