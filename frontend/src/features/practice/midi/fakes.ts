import type { Clock, InputListener, InputSource, MidiInputEvent, OutputSink, Ticker } from "./types.ts";

/** Input source for tests: call emit() to simulate playing. */
export class FakeInputSource implements InputSource {
    readonly id = "fake-input";
    readonly name = "Test input";
    private listeners = new Set<InputListener>();

    subscribe(listener: InputListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(event: MidiInputEvent): void {
        for (const listener of this.listeners) listener(event);
    }

    press(note: number, time: number, velocity = 100): void {
        this.emit({ type: "noteon", note, velocity, channel: 1, time });
    }

    release(note: number, time: number): void {
        this.emit({ type: "noteoff", note, velocity: 0, channel: 1, time });
    }
}

export interface RecordedMessage {
    data: number[];
    /** The timestamp passed to send(), or the clock time when none was given. */
    time: number;
    /** Clock time when send() was called. */
    sentAt: number;
}

/** Output sink for tests: records every message with its timestamp. */
export class RecordingSink implements OutputSink {
    readonly name = "Recording sink";
    readonly messages: RecordedMessage[] = [];
    private readonly clock: Clock;

    constructor(clock: Clock) {
        this.clock = clock;
    }

    send(data: number[], time?: number): void {
        const now = this.clock.now();
        this.messages.push({ data: [...data], time: time === undefined || time < now ? now : time, sentAt: now });
    }

    noteOns(): RecordedMessage[] {
        return this.messages.filter((m) => (m.data[0] & 0xf0) === 0x90 && m.data[2] > 0);
    }

    noteOffs(): RecordedMessage[] {
        return this.messages.filter((m) => (m.data[0] & 0xf0) === 0x80 || ((m.data[0] & 0xf0) === 0x90 && m.data[2] === 0));
    }

    controlChanges(controller?: number): RecordedMessage[] {
        return this.messages.filter((m) => (m.data[0] & 0xf0) === 0xb0 && (controller === undefined || m.data[1] === controller));
    }

    clear(): void {
        this.messages.length = 0;
    }
}

export class FakeClock implements Clock {
    private time: number;

    constructor(start = 0) {
        this.time = start;
    }

    now(): number {
        return this.time;
    }

    set(time: number): void {
        this.time = time;
    }

    advance(ms: number): void {
        this.time += ms;
    }
}

/** Ticker for tests: call tick() yourself. */
export class ManualTicker implements Ticker {
    private callback: (() => void) | null = null;

    start(callback: () => void): void {
        this.callback = callback;
    }

    stop(): void {
        this.callback = null;
    }

    get running(): boolean {
        return this.callback !== null;
    }

    tick(): void {
        this.callback?.();
    }
}

/** Advances a fake clock in steps, ticking after each step (like the 25 ms worker tick). */
export function runFor(clock: FakeClock, ticker: ManualTicker, ms: number, step = 25): void {
    const end = clock.now() + ms;
    while (clock.now() < end) {
        clock.advance(Math.min(step, end - clock.now()));
        ticker.tick();
    }
}
