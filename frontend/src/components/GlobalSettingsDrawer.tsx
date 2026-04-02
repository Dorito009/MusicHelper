import { Box, Drawer, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { formatInstrumentLabel, normalizeInstrumentName, ORCHESTRATION_INSTRUMENTS, playInstrumentPreview } from "../audio/soundfont.ts";
import { useInstrument, usePreferSimpleChordLabels, usePreferSimpleSpellings } from "../utils/preferences.ts";

type GlobalSettingsDrawerProps = {
    open: boolean;
    onClose: () => void;
};

export function GlobalSettingsDrawer({ open, onClose }: GlobalSettingsDrawerProps) {
    const [preferSimpleSpellings, setPreferSimpleSpellings] = usePreferSimpleSpellings();
    const [preferSimpleChordLabels, setPreferSimpleChordLabels] = usePreferSimpleChordLabels();
    const [instrument, setInstrument] = useInstrument();
    const selectedInstrument = normalizeInstrumentName(instrument);

    const handleInstrumentChange = (event: SelectChangeEvent<string>) => {
        const nextInstrument = normalizeInstrumentName(event.target.value);
        setInstrument(nextInstrument);
        void playInstrumentPreview(nextInstrument, "C4");
    };

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box sx={{ width: 320, p: 2.5 }}>
                <Stack spacing={2.5}>
                    <Typography variant="h6">Settings</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Control how note spellings, chord labels, and playback sound are shown across the app.
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
                    <FormControlLabel
                        control={
                            <Switch
                                checked={preferSimpleChordLabels}
                                onChange={(_, checked) => setPreferSimpleChordLabels(checked)}
                            />
                        }
                        label="Prefer simpler chord labels"
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel id="global-instrument-label">Instrument</InputLabel>
                        <Select
                            labelId="global-instrument-label"
                            value={selectedInstrument}
                            label="Instrument"
                            onChange={handleInstrumentChange}
                        >
                            {ORCHESTRATION_INSTRUMENTS.map((instrumentName) => (
                                <MenuItem key={instrumentName} value={instrumentName}>
                                    {formatInstrumentLabel(instrumentName)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </Box>
        </Drawer>
    );
}
