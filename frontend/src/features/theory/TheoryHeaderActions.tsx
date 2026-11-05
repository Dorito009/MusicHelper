import * as React from 'react'
import { IconButton } from '@mui/material'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import SettingsIcon from '@mui/icons-material/Settings'
import { setMuted } from './audio/soundfont.ts'
import { useSoundMuted } from './utils/preferences.ts'
import { TheorySettingsDrawer } from './TheorySettingsDrawer.tsx'

/** Mute and settings buttons for the right side of the header on theory pages. */
export function TheoryHeaderActions() {
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
    const [soundMuted, setSoundMuted] = useSoundMuted()

    React.useEffect(() => {
        setMuted(soundMuted)
    }, [soundMuted])

    return (
        <>
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

            <TheorySettingsDrawer open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    )
}
