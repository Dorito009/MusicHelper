import { Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import type { LoopRange } from "../engine/scoreConfig.ts";
import type { ParsedMeasure } from "../engine/types.ts";

/** Loop a measure range: pick from/to here, or shift-click measures in the score. */
export function LoopPanel({ measures, loop, onChange }: {
    measures: ParsedMeasure[];
    loop: LoopRange | null;
    onChange: (loop: LoopRange | null) => void;
}) {
    const last = Math.max(0, measures.length - 1);
    const from = loop?.from ?? 0;
    const to = loop?.to ?? last;

    const select = (label: string, value: number, onSelect: (value: number) => void, min: number, max: number) => (
        <FormControl size="small" fullWidth>
            <InputLabel id={`loop-${label}`}>{label}</InputLabel>
            <Select labelId={`loop-${label}`} label={label} value={value} onChange={(e) => onSelect(Number(e.target.value))}>
                {measures.slice(min, max + 1).map((m) => (
                    <MenuItem key={m.index} value={m.index}>Measure {m.number}</MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
                {select("From", from, (value) => onChange({ from: value, to: Math.max(value, to) }), 0, last)}
                {select("To", to, (value) => onChange({ from: Math.min(from, value), to: value }), 0, last)}
            </Stack>
            <Typography variant="body2" color="text.secondary">
                {loop
                    ? "The loop plays these measures straight through, over and over, until you stop."
                    : "No loop: the whole score plays once. Shift-click a measure in the score to start a loop, and shift-click another to extend it."}
            </Typography>
            {loop && (
                <Button variant="outlined" size="small" onClick={() => onChange(null)}>Clear loop and play the whole score</Button>
            )}
        </Stack>
    );
}
