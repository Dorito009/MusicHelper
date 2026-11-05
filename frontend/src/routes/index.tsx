import {createFileRoute, redirect} from "@tanstack/react-router";

// "/" has no page of its own yet, so send visitors to the scales page.
export const Route = createFileRoute("/")({
    beforeLoad: () => {
        throw redirect({
            to: '/scales',
            replace: true,
        });
    },
})
