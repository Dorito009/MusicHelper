import { createLink } from "@tanstack/react-router";
import { Button, IconButton, Link } from "@mui/material";

// MUI components that navigate with the router and keep typed route params.
export const LinkButton = createLink(Button);
export const LinkIconButton = createLink(IconButton);
export const TextLink = createLink(Link);
