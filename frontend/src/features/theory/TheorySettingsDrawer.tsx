import { Box, Drawer, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { formatInstrumentLabel, normalizeInstrumentName, ORCHESTRATION_INSTRUMENTS, playInstrumentPreview } from "./audio/soundfont.ts";
import { NOTE_DISPLAY_TEXT_SX } from "./utils/noteDisplay.ts";
import type { DoubleAccidentalDisplay, SingleAccidentalDisplay } from "./utils/preferences.ts";
import { useAccidentalDisplayPreference, useInstrument, usePreferSimpleChordLabels, usePreferSimpleSpellings } from "./utils/preferences.ts";

type TheorySettingsDrawerProps = {
    open: boolean;
    onClose: () => void;
};

export function TheorySettingsDrawer({ open, onClose }: TheorySettingsDrawerProps) {
    const [preferSimpleSpellings, setPreferSimpleSpellings] = usePreferSimpleSpellings();
    const [preferSimpleChordLabels, setPreferSimpleChordLabels] = usePreferSimpleChordLabels();
    const [instrument, setInstrument] = useInstrument();
    const [accidentalDisplay, , setAccidentalDisplay] = useAccidentalDisplayPreference();
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
                        Control how note spellings, chord labels, and playback sound are shown on the theory pages.
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
                    <Typography variant="subtitle2">Accidental Display</Typography>
                    <FormControl fullWidth size="small">
                        <InputLabel id="sharp-display-label">Sharp</InputLabel>
                        <Select
                            labelId="sharp-display-label"
                            value={accidentalDisplay.sharp}
                            label="Sharp"
                            sx={NOTE_DISPLAY_TEXT_SX}
                            onChange={(event) => setAccidentalDisplay("sharp", event.target.value as SingleAccidentalDisplay)}
                        >
                            <MenuItem value="unicode" sx={NOTE_DISPLAY_TEXT_SX}>C♯</MenuItem>
                            <MenuItem value="ascii" sx={NOTE_DISPLAY_TEXT_SX}>C#</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel id="flat-display-label">Flat</InputLabel>
                        <Select
                            labelId="flat-display-label"
                            value={accidentalDisplay.flat}
                            label="Flat"
                            sx={NOTE_DISPLAY_TEXT_SX}
                            onChange={(event) => setAccidentalDisplay("flat", event.target.value as SingleAccidentalDisplay)}
                        >
                            <MenuItem value="unicode" sx={NOTE_DISPLAY_TEXT_SX}>C♭</MenuItem>
                            <MenuItem value="ascii" sx={NOTE_DISPLAY_TEXT_SX}>Cb</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel id="double-sharp-display-label">Double Sharp</InputLabel>
                        <Select
                            labelId="double-sharp-display-label"
                            value={accidentalDisplay.doubleSharp}
                            label="Double Sharp"
                            sx={NOTE_DISPLAY_TEXT_SX}
                            onChange={(event) => setAccidentalDisplay("doubleSharp", event.target.value as DoubleAccidentalDisplay)}
                        >
                            <MenuItem value="unicode" sx={NOTE_DISPLAY_TEXT_SX}>C𝄪</MenuItem>
                            <MenuItem value="repeated-unicode" sx={NOTE_DISPLAY_TEXT_SX}>C♯♯</MenuItem>
                            <MenuItem value="ascii" sx={NOTE_DISPLAY_TEXT_SX}>C##</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel id="double-flat-display-label">Double Flat</InputLabel>
                        <Select
                            labelId="double-flat-display-label"
                            value={accidentalDisplay.doubleFlat}
                            label="Double Flat"
                            sx={NOTE_DISPLAY_TEXT_SX}
                            onChange={(event) => setAccidentalDisplay("doubleFlat", event.target.value as DoubleAccidentalDisplay)}
                        >
                            <MenuItem value="unicode" sx={NOTE_DISPLAY_TEXT_SX}>C𝄫</MenuItem>
                            <MenuItem value="repeated-unicode" sx={NOTE_DISPLAY_TEXT_SX}>C♭♭</MenuItem>
                            <MenuItem value="ascii" sx={NOTE_DISPLAY_TEXT_SX}>Cbb</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Box>
        </Drawer>
    );
}
