import { FormControl, InputLabel, MenuItem, Select, Stack } from "@mui/material";
import { usePracticeSettings } from "../settings/store.ts";
import type { SelectedDevices } from "./useMidi.ts";

const NONE = "__none__";

/** Input and output pickers. Devices are remembered by name. */
export function MidiDeviceSelect({ devices, direction = "column" }: { devices: SelectedDevices; direction?: "row" | "column" }) {
    const update = usePracticeSettings((s) => s.update);
    const { midi, inputName, outputName } = devices;
    const disabled = midi.status !== "ready";

    const inputOptions = midi.inputs.map((p) => p.name);
    const outputOptions = midi.outputs.map((p) => p.name);
    if (inputName && !inputOptions.includes(inputName)) inputOptions.push(inputName);
    if (outputName && !outputOptions.includes(outputName)) outputOptions.push(outputName);

    return (
        <Stack direction={{ xs: "column", sm: direction }} spacing={2} sx={{ width: "100%" }}>
            <FormControl size="small" fullWidth disabled={disabled}>
                <InputLabel id="midi-input-label">MIDI input (my keyboard)</InputLabel>
                <Select
                    labelId="midi-input-label"
                    label="MIDI input (my keyboard)"
                    value={inputName ?? NONE}
                    onChange={(e) => update("midi", { inputName: e.target.value === NONE ? null : e.target.value })}
                >
                    <MenuItem value={NONE}>None</MenuItem>
                    {inputOptions.map((name) => (
                        <MenuItem key={name} value={name}>
                            {name}{midi.inputs.some((p) => p.name === name) ? "" : " (not connected)"}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControl size="small" fullWidth disabled={disabled}>
                <InputLabel id="midi-output-label">MIDI output (sampler)</InputLabel>
                <Select
                    labelId="midi-output-label"
                    label="MIDI output (sampler)"
                    value={outputName ?? NONE}
                    onChange={(e) => update("midi", { outputName: e.target.value === NONE ? null : e.target.value })}
                >
                    <MenuItem value={NONE}>None</MenuItem>
                    {outputOptions.map((name) => (
                        <MenuItem key={name} value={name}>
                            {name}{midi.outputs.some((p) => p.name === name) ? "" : " (not connected)"}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Stack>
    );
}
