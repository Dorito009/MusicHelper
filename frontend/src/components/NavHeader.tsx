import * as React from 'react'
import { Link as RouterLink } from '@tanstack/react-router'
import { AppBar, Button, Container, Toolbar, Box, Typography, IconButton, Drawer, FormControlLabel, Switch, Stack } from '@mui/material'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'
import SettingsIcon from '@mui/icons-material/Settings'
import { usePreferSimpleSpellings } from '../utils/preferences.ts'

const pages = [
    { label: 'Scales', to: '/scales' },
    { label: 'Chords', to: '/chords' },
]

function NavHeader() {
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
    const [preferSimpleSpellings, setPreferSimpleSpellings] = usePreferSimpleSpellings()

    return (
        <AppBar position="static">
            <Container maxWidth="xl">
                <Toolbar disableGutters>
                    <LibraryMusicIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }}/>
                    <Typography
                        variant="h6"
                        sx={{
                            lineHeight: 1,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <Typography
                            variant="h6"
                            noWrap
                            component="a"
                            sx={{
                                mr: 2,
                                fontWeight: 700,
                            }}
                        >
                            Music Helper
                        </Typography>
                    </Typography>

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0,
                        }}
                     >
                         {pages.map((page) => (
                             <Button
                                key={page.to}
                                component={RouterLink}
                                to={page.to}
                                activeOptions={{ exact: true }}
                                sx={{
                                    color: 'white',
                                    '&[data-status="active"]': {
                                        color: 'secondary.main',
                                    },
                                }}
                             >
                                 {page.label}
                             </Button>
                         ))}
                     </Box>

                    <Box sx={{ ml: 'auto' }}>
                        <IconButton color="inherit" aria-label="open settings" onClick={() => setIsSettingsOpen(true)}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </Container>

            <Drawer anchor="right" open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
                <Box sx={{ width: 320, p: 2.5 }}>
                    <Stack spacing={2}>
                        <Typography variant="h6">Settings</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Control how note spellings are shown across the app.
                        </Typography>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={preferSimpleSpellings}
                                    onChange={(_, checked) => setPreferSimpleSpellings(checked)}
                                />
                            }
                            label="Prefer simpler note spellings"
                        />
                    </Stack>
                </Box>
            </Drawer>
        </AppBar>
    )
}

export default NavHeader
