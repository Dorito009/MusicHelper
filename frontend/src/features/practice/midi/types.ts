// MIDI layer types. Times are milliseconds on the performance.now() clock (the same clock as WebMidi.time).

export type MidiInputEvent =
    | { type: "noteon"; note: number; velocity: number; channel: number; time: number }
    | { type: "noteoff"; note: number; velocity: number; channel: number; time: number }
    | { type: "cc"; controller: number; value: number; channel: number; time: number };

export type InputListener = (event: MidiInputEvent) => void;

/** Anything that produces note input: a Web MIDI port, the computer keyboard, or a test fake. */
export interface InputSource {
    readonly id: string;
    readonly name: string;
    /** Returns an unsubscribe function. */
    subscribe(listener: InputListener): () => void;
    dispose?(): void;
}

/** Anything that accepts raw MIDI bytes: a Web MIDI port, or a recording fake in tests. */
export interface OutputSink {
    readonly name: string;
    /** `time` is an absolute timestamp; omitted or in the past means "send now". */
    send(data: number[], time?: number): void;
}

export interface Clock {
    now(): number;
}

export const performanceClock: Clock = {
    now: () => performance.now(),
};

/** Drives the scheduler, about every 25 ms. */
export interface Ticker {
    start(callback: () => void): void;
    stop(): void;
}

export const STATUS = {
    noteOff: 0x80,
    noteOn: 0x90,
    controlChange: 0xb0,
} as const;

export const CC = {
    modulation: 1,
    sustain: 64,
    allSoundOff: 120,
    allNotesOff: 123,
} as const;
