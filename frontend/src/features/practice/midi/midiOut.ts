import { CC, type Clock, type OutputSink, STATUS } from "./types.ts";

export const DEFAULT_LOOKAHEAD_MS = 120;

/**
 * Sends MIDI to the current output and remembers which channels and notes are in use,
 * so panic can silence everything. Sending with no output selected is a no-op.
 */
export class MidiOut {
    private readonly clock: Clock;
    private readonly getSink: () => OutputSink | null;
    private readonly usedChannels = new Set<number>();
    /** "channel:note" for notes we sent note-on for and haven't sent note-off for. */
    private readonly activeNotes = new Set<string>();
    private readonly lastCc = new Map<string, number>();

    constructor(clock: Clock, getSink: () => OutputSink | null) {
        this.clock = clock;
        this.getSink = getSink;
    }

    get hasOutput(): boolean {
        return this.getSink() !== null;
    }

    now(): number {
        return this.clock.now();
    }

    noteOn(channel: number, note: number, velocity: number, time?: number): void {
        this.usedChannels.add(channel);
        this.activeNotes.add(`${channel}:${note}`);
        this.send([STATUS.noteOn | (channel - 1), note & 0x7f, Math.max(1, Math.min(127, Math.round(velocity)))], time);
    }

    noteOff(channel: number, note: number, time?: number): void {
        this.usedChannels.add(channel);
        this.activeNotes.delete(`${channel}:${note}`);
        this.send([STATUS.noteOff | (channel - 1), note & 0x7f, 0], time);
    }

    controlChange(channel: number, controller: number, value: number, time?: number): void {
        this.usedChannels.add(channel);
        this.lastCc.set(`${channel}:${controller}`, value);
        this.send([STATUS.controlChange | (channel - 1), controller & 0x7f, Math.max(0, Math.min(127, Math.round(value)))], time);
    }

    /** Sends a CC only when its value differs from the last one sent on that channel. */
    controlChangeIfChanged(channel: number, controller: number, value: number, time?: number): void {
        if (this.lastCc.get(`${channel}:${controller}`) === value) return;
        this.controlChange(channel, controller, value, time);
    }

    /** Raw passthrough (used by MIDI thru). */
    sendRaw(data: number[], time?: number): void {
        const status = data[0] & 0xf0;
        const channel = (data[0] & 0x0f) + 1;
        if (status === STATUS.noteOn || status === STATUS.noteOff || status === STATUS.controlChange) this.usedChannels.add(channel);
        this.send(data, time);
    }

    markChannelUsed(channel: number): void {
        this.usedChannels.add(channel);
    }

    /**
     * Silences everything: note-off for every note we started, then All Notes Off (CC123) on every
     * channel used. CC123 goes out immediately and again just after the lookahead window, to catch
     * notes that were already queued with a future timestamp.
     */
    panic(extraChannels: Iterable<number> = [], lookaheadMs = DEFAULT_LOOKAHEAD_MS): void {
        const now = this.clock.now();
        for (const key of this.activeNotes) {
            const [channel, note] = key.split(":").map(Number);
            this.send([STATUS.noteOff | (channel - 1), note, 0]);
        }
        this.activeNotes.clear();
        const channels = new Set([...this.usedChannels, ...extraChannels]);
        for (const channel of channels) {
            this.send([STATUS.controlChange | (channel - 1), CC.allNotesOff, 0]);
        }
        const later = now + lookaheadMs + 20;
        for (const channel of channels) {
            this.send([STATUS.controlChange | (channel - 1), CC.allNotesOff, 0], later);
        }
        this.lastCc.clear();
    }

    /** All Notes Off on every used channel at one timestamp (used at a loop boundary). */
    allNotesOffAt(time: number, extraChannels: Iterable<number> = []): void {
        const channels = new Set([...this.usedChannels, ...extraChannels]);
        for (const channel of channels) {
            this.send([STATUS.controlChange | (channel - 1), CC.allNotesOff, 0], time);
        }
        this.activeNotes.clear();
    }

    private send(data: number[], time?: number): void {
        const sink = this.getSink();
        if (!sink) return;
        sink.send(data, time);
    }
}
