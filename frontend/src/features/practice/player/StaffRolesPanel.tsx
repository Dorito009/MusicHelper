import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import type { DynamicsMode, ScoreConfig, StaffRole } from "../engine/scoreConfig.ts";
import type { StaffInfo } from "../engine/types.ts";
import { staffLabel } from "./playerUtils.ts";

/** Who plays each staff, on which channel, and how dynamics are sent. */
export function StaffRolesPanel({ staves, config, onChange, disabled }: {
    staves: StaffInfo[];
    config: ScoreConfig;
    onChange: (config: ScoreConfig) => void;
    disabled?: boolean;
}) {
    const set = (key: string, patch: Partial<ScoreConfig["staves"][string]>) => {
        onChange({ ...config, staves: { ...config.staves, [key]: { ...config.staves[key], ...patch } } });
    };

    return (
        <Stack spacing={2}>
            {staves.map((staff) => {
                const value = config.staves[staff.key];
                if (!value) return null;
                return (
                    <Stack key={staff.key} spacing={1}>
                        <Typography variant="subtitle2">{staffLabel(staff)}</Typography>
                        <Stack direction="row" spacing={1}>
                            <FormControl size="small" fullWidth disabled={disabled}>
                                <InputLabel id={`role-${staff.key}`}>Who plays</InputLabel>
                                <Select
                                    labelId={`role-${staff.key}`}
                                    label="Who plays"
                                    value={value.role}
                                    onChange={(e) => set(staff.key, { role: e.target.value as StaffRole })}
                                >
                                    <MenuItem value="me">I play (graded)</MenuItem>
                                    <MenuItem value="app">App plays</MenuItem>
                                    <MenuItem value="off">Off (shown only)</MenuItem>
                                </Select>
                            </FormControl>
                            {value.role === "app" && (
                                <FormControl size="small" sx={{ minWidth: 92 }} disabled={disabled}>
                                    <InputLabel id={`channel-${staff.key}`}>Channel</InputLabel>
                                    <Select
                                        labelId={`channel-${staff.key}`}
                                        label="Channel"
                                        value={value.channel}
                                        onChange={(e) => set(staff.key, { channel: Number(e.target.value) })}
                                    >
                                        {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                                            <MenuItem key={ch} value={ch}>{ch}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                        </Stack>
                        {value.role === "app" && (
                            <FormControl size="small" fullWidth disabled={disabled}>
                                <InputLabel id={`dyn-${staff.key}`}>Send dynamics as</InputLabel>
                                <Select
                                    labelId={`dyn-${staff.key}`}
                                    label="Send dynamics as"
                                    value={value.dynamics}
                                    onChange={(e) => set(staff.key, { dynamics: e.target.value as DynamicsMode })}
                                >
                                    <MenuItem value="velocity">Velocity</MenuItem>
                                    <MenuItem value="cc1">CC1 (mod wheel)</MenuItem>
                                    <MenuItem value="both">Velocity and CC1</MenuItem>
                                </Select>
                            </FormControl>
                        )}
                    </Stack>
                );
            })}
        </Stack>
    );
}
