import * as React from 'react'
import { Link as RouterLink } from '@tanstack/react-router'
import { AppBar, Button, Container, IconButton, Box, Typography, Toolbar } from '@mui/material'
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import SettingsIcon from '@mui/icons-material/Settings'
import { setMuted } from '../features/theory/audio/soundfont.ts'
import { useSoundMuted } from '../features/theory/utils/preferences.ts'
import { GlobalSettingsDrawer } from '../features/theory/GlobalSettingsDrawer.tsx'

const pages = [
    { label: 'Scales', to: '/scales' },
    { label: 'Chords', to: '/chords' },
]

function NavHeader() {
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
    const [soundMuted, setSoundMuted] = useSoundMuted()

    React.useEffect(() => {
        setMuted(soundMuted)
    }, [soundMuted])

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

                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                        <IconButton
                            color="inherit"
                            aria-label={soundMuted ? 'unmute sound' : 'mute sound'}
                            onClick={() => setSoundMuted(!soundMuted)}
                        >
                            {soundMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                        </IconButton>
                        <IconButton color="inherit" aria-label="open settings" onClick={() => setIsSettingsOpen(true)}>
                            <SettingsIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </Container>

            <GlobalSettingsDrawer open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </AppBar>
    )
}

export default NavHeader
