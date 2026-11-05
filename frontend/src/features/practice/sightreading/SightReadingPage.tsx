import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Checkbox,
    Container,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getAllScaleTypes } from "musiclib";
import { generateExercise, type ExerciseOptions, type NoteValue } from "../engine/generator/generate.ts";
import { randomSeed, shortHash } from "../engine/generator/random.ts";
import { defaultScoreConfig, type ScoreConfig } from "../engine/scoreConfig.ts";
import { parseMusicXml } from "../engine/musicxml.ts";
import { PracticePlayer } from "../player/PracticePlayer.tsx";
import { channelDefaultsFromSettings, getPracticeSettings } from "../settings/store.ts";
import { practiceDb } from "../storage/db.ts";
import { saveExerciseToLibrary } from "../storage/scores.ts";
import { midiNoteName } from "../ui/noteNames.ts";
import { LinkButton } from "../ui/RouterLinks.tsx";
import { loadExerciseOptions, RANGE_DEFAULTS, storeExerciseOptions } from "./options.ts";

const TONICS = ["C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb"];
const NOTE_VALUES: Array<{ value: NoteValue; label: string }> = [
    { value: "whole", label: "Whole" },
    { value: "half", label: "Half" },
    { value: "quarter", label: "Quarter" },
    { value: "eighth", label: "Eighth" },
];
const LEAPS = [
    { value: 2, label: "A second (steps only)" },
    { value: 4, label: "A third" },
    { value: 5, label: "A fourth" },
    { value: 7, label: "A fifth" },
    { value: 9, label: "A sixth" },
    { value: 12, label: "An octave" },
];
const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8"];
const RANGE_NOTES = Array.from({ length: 61 }, (_, i) => 36 + i); // C2..C7

function displayTonic(tonic: string): string {
    return tonic.replace("#", "♯").replace(/^([A-G])b$/, "$1♭");
}

export function SightReadingPage() {
    const [options, setOptions] = React.useState<ExerciseOptions>(loadExerciseOptions);
    const [seedText, setSeedText] = React.useState(options.seed);
    const [savedMessage, setSavedMessage] = React.useState(false);

    React.useEffect(() => storeExerciseOptions(options), [options]);

    const exercise = React.useMemo(() => {
        try {
            const { xml, title } = generateExercise(options);
            const id = `sight-${shortHash(JSON.stringify(options))}`;
            return { xml, title, id, error: null as string | null };
        } catch (error) {
            return { xml: null, title: "", id: "", error: error instanceof Error ? error.message : String(error) };
        }
    }, [options]);

    const [config, setConfig] = React.useState<ScoreConfig | null>(null);
    const [configFor, setConfigFor] = React.useState<string | null>(null);
    if (exercise.xml && configFor !== exercise.id) {
        setConfigFor(exercise.id);
        setConfig(defaultScoreConfig(parseMusicXml(exercise.xml), channelDefaultsFromSettings(getPracticeSettings())));
        setSavedMessage(false);
    }

    const inLibrary = useLiveQuery(async () => (exercise.id ? (await practiceDb.scores.get(exercise.id)) !== undefined : false), [exercise.id]);

    const set = (patch: Partial<ExerciseOptions>) => setOptions((current) => ({ ...current, ...patch }));
    const nextExercise = () => {
        const seed = randomSeed();
        setSeedText(seed);
        set({ seed });
    };

    const save = async () => {
        if (!exercise.xml) return;
        await saveExerciseToLibrary({ id: exercise.id, xml: exercise.xml, title: `${exercise.title} (${options.seed})`, seed: options.seed });
        setSavedMessage(true);
    };

    const toggleValue = (value: NoteValue, on: boolean) => {
        const next = on ? [...options.noteValues, value] : options.noteValues.filter((v) => v !== value);
        if (next.length > 0) set({ noteValues: next });
    };

    const form = (
        <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-clef">Clef</InputLabel>
                    <Select labelId="sr-clef" label="Clef" value={options.clef} onChange={(e) => {
                        const clef = e.target.value as ExerciseOptions["clef"];
                        set({ clef, ...RANGE_DEFAULTS[clef] });
                    }}>
                        <MenuItem value="treble">Treble</MenuItem>
                        <MenuItem value="bass">Bass</MenuItem>
                        <MenuItem value="grand">Grand staff (both hands)</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-key">Key</InputLabel>
                    <Select labelId="sr-key" label="Key" value={options.tonic} onChange={(e) => set({ tonic: e.target.value })}>
                        {TONICS.map((tonic) => <MenuItem key={tonic} value={tonic}>{displayTonic(tonic)}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-scale">Scale</InputLabel>
                    <Select labelId="sr-scale" label="Scale" value={options.scaleType} onChange={(e) => set({ scaleType: e.target.value })}>
                        {getAllScaleTypes().map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-time">Time signature</InputLabel>
                    <Select labelId="sr-time" label="Time signature" value={`${options.timeSignature.beats}/${options.timeSignature.beatType}`} onChange={(e) => {
                        const [beats, beatType] = String(e.target.value).split("/").map(Number);
                        set({ timeSignature: { beats, beatType } });
                    }}>
                        {TIME_SIGNATURES.map((sig) => <MenuItem key={sig} value={sig}>{sig}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-low">{options.clef === "grand" ? "Lowest right-hand note" : "Lowest note"}</InputLabel>
                    <Select labelId="sr-low" label={options.clef === "grand" ? "Lowest right-hand note" : "Lowest note"} value={options.lowest} onChange={(e) => set({ lowest: Number(e.target.value) })}>
                        {RANGE_NOTES.map((midi) => <MenuItem key={midi} value={midi}>{midiNoteName(midi)}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-high">{options.clef === "grand" ? "Highest right-hand note" : "Highest note"}</InputLabel>
                    <Select labelId="sr-high" label={options.clef === "grand" ? "Highest right-hand note" : "Highest note"} value={options.highest} onChange={(e) => set({ highest: Number(e.target.value) })}>
                        {RANGE_NOTES.map((midi) => <MenuItem key={midi} value={midi}>{midiNoteName(midi)}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="sr-leap">Largest leap</InputLabel>
                    <Select labelId="sr-leap" label="Largest leap" value={options.maxLeap} onChange={(e) => set({ maxLeap: Number(e.target.value) })}>
                        {LEAPS.map((leap) => <MenuItem key={leap.value} value={leap.value}>{leap.label}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: { md: "center" } }}>
                <FormControl component="fieldset">
                    <FormLabel component="legend">Note values</FormLabel>
                    <FormGroup row>
                        {NOTE_VALUES.map(({ value, label }) => (
                            <FormControlLabel key={value} label={label} control={
                                <Checkbox size="small" checked={options.noteValues.includes(value)} onChange={(_, on) => toggleValue(value, on)} />
                            } />
                        ))}
                    </FormGroup>
                </FormControl>
                <FormControlLabel control={<Switch checked={options.dotted} onChange={(_, on) => set({ dotted: on })} />} label="Dotted notes" />
                <FormControlLabel control={<Switch checked={options.rests} onChange={(_, on) => set({ rests: on })} />} label="Rests" />
                <FormControlLabel control={<Switch checked={options.accidentals} onChange={(_, on) => set({ accidentals: on })} />} label="Notes outside the key" />
            </Stack>
            <Box sx={{ maxWidth: 420 }}>
                <Typography gutterBottom>Measures: {options.measures}</Typography>
                <Slider value={options.measures} min={4} max={32} step={1} onChange={(_, value) => set({ measures: value as number })} aria-label="Number of measures" />
            </Box>
        </Stack>
    );

    return (
        <Container maxWidth="xl" sx={{ py: 2 }}>
            <Typography variant="h4" component="h1">Sight-reading</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                Generate an exercise, play it once, then go to the next one. Runs are graded and saved like any other score.
            </Typography>

            <Accordion defaultExpanded disableGutters variant="outlined" sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>Exercise options</Typography>
                </AccordionSummary>
                <AccordionDetails>{form}</AccordionDetails>
            </Accordion>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2, alignItems: { sm: "center" } }}>
                <Button variant="contained" startIcon={<SkipNextIcon />} onClick={nextExercise}>Next exercise</Button>
                <TextField
                    size="small"
                    label="Seed"
                    value={seedText}
                    onChange={(e) => setSeedText(e.target.value.trim())}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && seedText) set({ seed: seedText });
                    }}
                    sx={{ width: 160 }}
                    slotProps={{ htmlInput: { "data-testid": "seed-input" } }}
                />
                <Button startIcon={<RefreshIcon />} onClick={() => seedText && set({ seed: seedText })} disabled={!seedText || seedText === options.seed}>
                    Generate from this seed
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => void save()} disabled={!exercise.xml || inLibrary === true}>
                    {inLibrary ? "Saved in the library" : "Save to library"}
                </Button>
            </Stack>
            {savedMessage && (
                <Alert severity="success" sx={{ mb: 2 }} action={<LinkButton to="/practice" color="inherit">Open the library</LinkButton>}>
                    Saved to the library. Its history so far was kept.
                </Alert>
            )}

            {exercise.error && <Alert severity="error">{exercise.error}</Alert>}
            {exercise.xml && config && (
                <PracticePlayer
                    key={exercise.id}
                    scoreId={exercise.id}
                    title={`${exercise.title} · seed ${options.seed}`}
                    xml={exercise.xml}
                    config={config}
                    onConfigChange={setConfig}
                />
            )}
        </Container>
    );
}
