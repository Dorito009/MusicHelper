import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import { practiceDb, type ScoreRecord } from "../storage/db.ts";
import { deleteScore, importScoreFile, renameScore } from "../storage/scores.ts";
import { isScoreFileName, SCORE_FILE_EXTENSIONS } from "../engine/mxl.ts";
import { formatPercent, formatRelativeDate } from "../ui/format.ts";
import { LinkButton, LinkIconButton, TextLink } from "../ui/RouterLinks.tsx";

interface ImportMessage {
    severity: "success" | "error";
    text: string;
}

export function LibraryPage() {
    const scores = useLiveQuery(() => practiceDb.scores.orderBy("addedAt").reverse().toArray(), []);
    const fileInput = React.useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = React.useState(false);
    const [messages, setMessages] = React.useState<ImportMessage[]>([]);
    const [renaming, setRenaming] = React.useState<ScoreRecord | null>(null);
    const [deleting, setDeleting] = React.useState<ScoreRecord | null>(null);
    const dragDepth = React.useRef(0);

    const importFiles = async (files: File[]) => {
        const next: ImportMessage[] = [];
        let imported = 0;
        for (const file of files) {
            if (!isScoreFileName(file.name)) {
                next.push({ severity: "error", text: `${file.name}: not a MusicXML file. Use ${SCORE_FILE_EXTENSIONS.join(", ")}.` });
                continue;
            }
            try {
                await importScoreFile(file);
                imported++;
            } catch (error) {
                next.push({ severity: "error", text: `${file.name}: ${error instanceof Error ? error.message : "couldn't be imported."}` });
            }
        }
        if (imported > 0) next.unshift({ severity: "success", text: `Imported ${imported} ${imported === 1 ? "score" : "scores"}.` });
        setMessages(next);
    };

    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void importFiles(Array.from(event.dataTransfer.files));
    };

    const openPicker = () => fileInput.current?.click();

    return (
        <Box
            onDragEnter={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                dragDepth.current++;
                setDragging(true);
            }}
            onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDragging(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            sx={{ minHeight: "calc(100vh - 64px)", position: "relative" }}
            data-testid="library-drop-zone"
        >
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, alignItems: { sm: "center" } }}>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h4" component="h1">Score library</Typography>
                        <Typography color="text.secondary">
                            Import MusicXML scores, then practice them on your MIDI keyboard.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <LinkButton variant="outlined" to="/practice/sight-reading">
                            Generate an exercise
                        </LinkButton>
                        <Button variant="contained" startIcon={<UploadFileIcon />} onClick={openPicker}>
                            Import scores
                        </Button>
                    </Stack>
                    <input
                        ref={fileInput}
                        type="file"
                        hidden
                        multiple
                        accept={[...SCORE_FILE_EXTENSIONS, "application/vnd.recordare.musicxml+xml", "application/vnd.recordare.musicxml"].join(",")}
                        data-testid="score-file-input"
                        onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            event.target.value = "";
                            void importFiles(files);
                        }}
                    />
                </Stack>

                <Stack spacing={1} sx={{ mb: 2 }}>
                    {messages.map((message, i) => (
                        <Alert key={i} severity={message.severity} onClose={() => setMessages((m) => m.filter((_, j) => j !== i))}>
                            {message.text}
                        </Alert>
                    ))}
                </Stack>

                {scores === undefined ? null : scores.length === 0 ? (
                    <EmptyLibrary onImport={openPicker} />
                ) : (
                    <>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small" aria-label="Scores">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Title</TableCell>
                                        <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Composer</TableCell>
                                        <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>Staves</TableCell>
                                        <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Last practiced</TableCell>
                                        <TableCell align="right">Best</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {scores.map((score) => (
                                        <TableRow key={score.id} hover>
                                            <TableCell>
                                                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                    <TextLink to="/practice/play/$scoreId" params={{ scoreId: score.id }} color="inherit" underline="hover" sx={{ fontWeight: 500 }}>
                                                        {score.title}
                                                    </TextLink>
                                                    {score.source === "sight-reading" && <Chip size="small" label="Sight-reading" />}
                                                </Stack>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: { md: "none" } }}>
                                                    {score.composer}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>{score.composer || "–"}</TableCell>
                                            <TableCell align="right" sx={{ display: { xs: "none", sm: "table-cell" } }}>{score.staffCount}</TableCell>
                                            <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>{formatRelativeDate(score.lastPracticedAt)}</TableCell>
                                            <TableCell align="right">{formatPercent(score.bestAccuracy)}</TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                <Tooltip title="Practice this score">
                                                    <LinkIconButton to="/practice/play/$scoreId" params={{ scoreId: score.id }} aria-label={`Practice ${score.title}`}>
                                                        <PlayArrowIcon />
                                                    </LinkIconButton>
                                                </Tooltip>
                                                <Tooltip title="Rename">
                                                    <IconButton onClick={() => setRenaming(score)} aria-label={`Rename ${score.title}`}>
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton onClick={() => setDeleting(score)} aria-label={`Delete ${score.title}`}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Tip: drop .musicxml, .xml or .mxl files anywhere on this page to import them.
                        </Typography>
                    </>
                )}
            </Container>

            {dragging && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 8,
                        border: "3px dashed",
                        borderColor: "primary.main",
                        borderRadius: 2,
                        bgcolor: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 10,
                    }}
                >
                    <Typography variant="h5">Drop to import</Typography>
                </Box>
            )}

            <RenameDialog score={renaming} onClose={() => setRenaming(null)} />
            <Dialog open={deleting !== null} onClose={() => setDeleting(null)}>
                <DialogTitle>Delete this score?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        “{deleting?.title}” and its practice history will be removed from this browser. This can't be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleting(null)}>Cancel</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={() => {
                            if (deleting) void deleteScore(deleting.id);
                            setDeleting(null);
                        }}
                    >
                        Delete score
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function EmptyLibrary({ onImport }: { onImport: () => void }) {
    return (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 6 }, textAlign: "center", borderStyle: "dashed" }}>
            <LibraryMusicIcon sx={{ fontSize: 56, color: "text.secondary", mb: 1 }} />
            <Typography variant="h6">No scores yet</Typography>
            <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: "auto" }}>
                Export a score from MuseScore, Dorico, Sibelius or Finale as MusicXML (.musicxml, .xml or .mxl),
                then import it here or drop the file on this page.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "center" }}>
                <Button variant="contained" startIcon={<UploadFileIcon />} onClick={onImport}>
                    Import scores
                </Button>
                <LinkButton variant="outlined" to="/practice/sight-reading">
                    Generate a sight-reading exercise
                </LinkButton>
            </Stack>
        </Paper>
    );
}

function RenameDialog({ score, onClose }: { score: ScoreRecord | null; onClose: () => void }) {
    const [title, setTitle] = React.useState("");
    const [lastScoreId, setLastScoreId] = React.useState<string | null>(null);
    if ((score?.id ?? null) !== lastScoreId) {
        setLastScoreId(score?.id ?? null);
        setTitle(score?.title ?? "");
    }

    const save = () => {
        if (score && title.trim()) void renameScore(score.id, title);
        onClose();
    };

    return (
        <Dialog open={score !== null} onClose={onClose} fullWidth maxWidth="xs">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                <DialogTitle>Rename score</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        margin="dense"
                        label="Title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={!title.trim()}>
                        Save name
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
