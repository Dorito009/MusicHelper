import * as React from 'react'
import { Link as RouterLink, useMatchRoute } from '@tanstack/react-router'
import type { FileRoutesByTo } from '../routeTree.gen'
import { AppBar, Box, Button, Container, IconButton, ListSubheader, Menu, MenuItem, Toolbar, Typography } from '@mui/material'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

type AppRoutePath = keyof FileRoutesByTo

/** A single page link in the header. */
export type AppHeaderLink = {
    label: string
    to: AppRoutePath
}

/** A group of links shown as one dropdown button (closed by default). */
export type AppHeaderMenu = {
    label: string
    items: AppHeaderLink[]
}

export type AppHeaderNavItem = AppHeaderLink | AppHeaderMenu

type AppHeaderProps = {
    /** Where the "Music Helper" title links to. */
    homeTo: AppRoutePath
    /** Nav links for the current section, shown left of the actions. */
    navItems: AppHeaderNavItem[]
    /** Section-specific buttons shown on the right. */
    actions?: React.ReactNode
}

const NAV_BUTTON_SX = {
    color: 'white',
    '&[data-status="active"]': {
        color: 'secondary.main',
    },
}

function isMenu(item: AppHeaderNavItem): item is AppHeaderMenu {
    return 'items' in item
}

function AppHeader({ homeTo, navItems, actions }: AppHeaderProps) {
    return (
        <AppBar position="static">
            <Container maxWidth="xl">
                <Toolbar disableGutters>
                    <LibraryMusicIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                    <Typography
                        variant="h6"
                        noWrap
                        component={RouterLink}
                        to={homeTo}
                        sx={{
                            mr: 2,
                            fontWeight: 700,
                            lineHeight: 1,
                            color: 'inherit',
                            textDecoration: 'none',
                        }}
                    >
                        Music Helper
                    </Typography>

                    {/* Wide screens: links inline */}
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0 }}>
                        {navItems.map((item) =>
                            isMenu(item)
                                ? <NavDropdown key={item.label} menu={item}/>
                                : (
                                    <Button
                                        key={item.to}
                                        component={RouterLink}
                                        to={item.to}
                                        activeOptions={{ exact: true }}
                                        sx={NAV_BUTTON_SX}
                                    >
                                        {item.label}
                                    </Button>
                                )
                        )}
                    </Box>

                    {/* Narrow screens: links collapse into one menu */}
                    <Box sx={{ display: { xs: 'flex', sm: 'none' } }}>
                        <CollapsedNavMenu navItems={navItems}/>
                    </Box>

                    {actions && (
                        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                            {actions}
                        </Box>
                    )}
                </Toolbar>
            </Container>
        </AppBar>
    )
}

function NavDropdown({ menu }: { menu: AppHeaderMenu }) {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
    const matchRoute = useMatchRoute()
    const open = Boolean(anchorEl)
    const isActive = menu.items.some((link) => Boolean(matchRoute({ to: link.to })))
    const menuId = `nav-menu-${menu.label.toLowerCase()}`

    return (
        <>
            <Button
                id={`${menuId}-button`}
                aria-controls={open ? menuId : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                endIcon={<ExpandMoreIcon/>}
                data-status={isActive ? 'active' : undefined}
                sx={NAV_BUTTON_SX}
            >
                {menu.label}
            </Button>
            <Menu
                id={menuId}
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                slotProps={{ list: { 'aria-labelledby': `${menuId}-button` } }}
            >
                {menu.items.map((link) => (
                    <MenuItem
                        key={link.to}
                        component={RouterLink}
                        to={link.to}
                        selected={Boolean(matchRoute({ to: link.to }))}
                        onClick={() => setAnchorEl(null)}
                    >
                        {link.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    )
}

function CollapsedNavMenu({ navItems }: { navItems: AppHeaderNavItem[] }) {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
    const matchRoute = useMatchRoute()
    const close = () => setAnchorEl(null)

    const renderLink = (link: AppHeaderLink, indent: boolean) => (
        <MenuItem
            key={link.to}
            component={RouterLink}
            to={link.to}
            selected={Boolean(matchRoute({ to: link.to }))}
            onClick={close}
            sx={indent ? { pl: 4 } : undefined}
        >
            {link.label}
        </MenuItem>
    )

    // Menu children must be a flat list (no fragments).
    const entries = navItems.flatMap((item) =>
        isMenu(item)
            ? [
                <ListSubheader key={`header-${item.label}`}>{item.label}</ListSubheader>,
                ...item.items.map((link) => renderLink(link, true)),
            ]
            : [renderLink(item, false)]
    )

    return (
        <>
            <IconButton
                color="inherit"
                aria-label="open navigation menu"
                aria-controls={anchorEl ? 'nav-menu-collapsed' : undefined}
                aria-haspopup="true"
                onClick={(event) => setAnchorEl(event.currentTarget)}
            >
                <MenuIcon/>
            </IconButton>
            <Menu id="nav-menu-collapsed" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
                {entries}
            </Menu>
        </>
    )
}

export default AppHeader
