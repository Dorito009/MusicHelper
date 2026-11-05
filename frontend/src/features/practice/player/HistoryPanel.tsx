import { useLiveQuery } from "dexie-react-hooks";
import { IconButton, List, ListItem, ListItemText, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { practiceDb } from "../storage/db.ts";
import { deleteSession } from "../storage/scores.ts";
import { formatDateTime } from "../ui/format.ts";

/** Past sessions for one score, newest first. */
export function HistoryPanel({ scoreId, measureLabel }: { scoreId: string; measureLabel: (measureIndex: number) => string }) {
    const sessions = useLiveQuery(
        () => practiceDb.sessions.where("[scoreId+startedAt]").between([scoreId, 0], [scoreId, Infinity]).reverse().limit(50).toArray(),
        [scoreId],
    );
    if (!sessions) return null;
    if (sessions.length === 0) {
        return <Typography variant="body2" color="text.secondary">No sessions yet. Each run you finish is saved here.</Typography>;
    }
    return (
        <List dense disablePadding data-testid="history-list">
            {sessions.map((session) => {
                const range = session.measureRange
                    ? ` · m. ${measureLabel(session.measureRange.from)}–${measureLabel(session.measureRange.to)}`
                    : "";
                const mode = session.mode === "wait" ? "Wait" : session.rhythmOnly ? "Rhythm" : "Play along";
                return (
                    <ListItem
                        key={session.id}
                        disableGutters
                        secondaryAction={
                            <Tooltip title="Delete this session">
                                <IconButton edge="end" size="small" aria-label="Delete session" onClick={() => void deleteSession(session.id)}>
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        }
                    >
                        <ListItemText
                            primary={
                                <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                                    <Typography component="span" sx={{ fontWeight: 600, minWidth: 48 }}>{Math.round(session.stats.accuracy)} %</Typography>
                                    <Typography component="span" variant="body2">{mode} · {Math.round(session.bpm)} BPM{range}</Typography>
                                </Stack>
                            }
                            secondary={formatDateTime(session.startedAt)}
                        />
                    </ListItem>
                );
            })}
        </List>
    );
}
