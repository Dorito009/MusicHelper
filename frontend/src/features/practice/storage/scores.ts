import { parseMusicXml } from "../engine/musicxml.ts";
import { scoreXmlFromBytes } from "../engine/mxl.ts";
import { defaultScoreConfig, type ScoreConfig } from "../engine/scoreConfig.ts";
import { channelDefaultsFromSettings, getPracticeSettings } from "../settings/store.ts";
import { newId, practiceDb, type ScoreRecord, type SessionRecord } from "./db.ts";

function titleFromFileName(fileName: string): string {
    return fileName.replace(/\.(musicxml|xml|mxl)$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled score";
}

/** Reads, validates and stores an imported file. Throws ScoreParseError with a readable message. */
export async function importScoreFile(file: File): Promise<ScoreRecord> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return importScoreXml(scoreXmlFromBytes(bytes), file.name);
}

export async function importScoreXml(xml: string, fileName: string, extra: Partial<ScoreRecord> = {}): Promise<ScoreRecord> {
    const parsed = parseMusicXml(xml);
    const record: ScoreRecord = {
        id: newId(),
        title: parsed.title || titleFromFileName(fileName),
        composer: parsed.composer,
        fileName,
        xml,
        addedAt: Date.now(),
        lastPracticedAt: null,
        config: defaultScoreConfig(parsed, channelDefaultsFromSettings(getPracticeSettings())),
        staffCount: parsed.staves.length,
        source: "import",
        bestAccuracy: null,
        ...extra,
    };
    await practiceDb.scores.put(record);
    return record;
}

export async function renameScore(id: string, title: string): Promise<void> {
    const trimmed = title.trim();
    if (!trimmed) return;
    await practiceDb.scores.update(id, { title: trimmed });
}

/** Deletes a score and its practice history. */
export async function deleteScore(id: string): Promise<void> {
    await practiceDb.transaction("rw", practiceDb.scores, practiceDb.sessions, async () => {
        await practiceDb.sessions.where("scoreId").equals(id).delete();
        await practiceDb.scores.delete(id);
    });
}

export async function updateScoreConfig(id: string, config: ScoreConfig): Promise<void> {
    await practiceDb.scores.update(id, { config });
}

/** Saves a finished run and updates the score's last-practiced time and best accuracy. */
export async function saveSession(session: Omit<SessionRecord, "id">): Promise<SessionRecord> {
    const record: SessionRecord = { ...session, id: newId() };
    await practiceDb.transaction("rw", practiceDb.scores, practiceDb.sessions, async () => {
        await practiceDb.sessions.add(record);
        const score = await practiceDb.scores.get(session.scoreId);
        if (score) {
            await practiceDb.scores.update(session.scoreId, {
                lastPracticedAt: session.startedAt,
                bestAccuracy: Math.max(score.bestAccuracy ?? 0, session.stats.accuracy),
            });
        }
    });
    return record;
}

export async function deleteSession(id: string): Promise<void> {
    await practiceDb.sessions.delete(id);
}
