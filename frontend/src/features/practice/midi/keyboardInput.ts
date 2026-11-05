import type { InputListener, InputSource, MidiInputEvent } from "./types.ts";

/** DAW-style layout: the A row plays white keys, the W row black keys. Z/X change the octave. */
export const KEYBOARD_NOTE_CODES: Record<string, number> = {
    KeyA: 0, // C
    KeyW: 1,
    KeyS: 2,
    KeyE: 3,
    KeyD: 4,
    KeyF: 5,
    KeyT: 6,
    KeyG: 7,
    KeyY: 8,
    KeyH: 9,
    KeyU: 10,
    KeyJ: 11,
    KeyK: 12, // C one octave up
};

export const KEYBOARD_OCTAVE_CODES = { down: "KeyZ", up: "KeyX" } as const;

/** Key codes used for notes or octave changes; shortcuts must avoid them. */
export const KEYBOARD_INPUT_CODES = new Set<string>([...Object.keys(KEYBOARD_NOTE_CODES), "KeyZ", "KeyX"]);

export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return target.isContentEditable || target.getAttribute("role") === "combobox";
}

export interface KeyboardInputOptions {
    /** Octave of the A key's C (4 = middle C, MIDI 60). */
    octave: number;
    velocity?: number;
    onOctaveChange?: (octave: number) => void;
    target?: Window;
}

/** The computer keyboard as a note input. */
export class ComputerKeyboardInput implements InputSource {
    readonly id = "computer-keyboard";
    readonly name = "Computer keyboard";
    private listeners = new Set<InputListener>();
    private octave: number;
    private readonly velocity: number;
    private readonly onOctaveChange?: (octave: number) => void;
    private readonly target: Window;
    /** Key code -> MIDI note that is sounding, so key-up releases the right note after an octave change. */
    private held = new Map<string, number>();

    constructor(options: KeyboardInputOptions) {
        this.octave = options.octave;
        this.velocity = options.velocity ?? 96;
        this.onOctaveChange = options.onOctaveChange;
        this.target = options.target ?? window;
        this.target.addEventListener("keydown", this.onKeyDown);
        this.target.addEventListener("keyup", this.onKeyUp);
        this.target.addEventListener("blur", this.releaseAll);
    }

    setOctave(octave: number): void {
        this.octave = Math.max(0, Math.min(8, octave));
    }

    subscribe(listener: InputListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    dispose(): void {
        this.releaseAll();
        this.target.removeEventListener("keydown", this.onKeyDown);
        this.target.removeEventListener("keyup", this.onKeyUp);
        this.target.removeEventListener("blur", this.releaseAll);
        this.listeners.clear();
    }

    private emit(event: MidiInputEvent): void {
        for (const listener of this.listeners) listener(event);
    }

    private readonly onKeyDown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
        if (event.code === KEYBOARD_OCTAVE_CODES.down || event.code === KEYBOARD_OCTAVE_CODES.up) {
            event.preventDefault();
            if (event.repeat) return;
            this.setOctave(this.octave + (event.code === KEYBOARD_OCTAVE_CODES.up ? 1 : -1));
            this.onOctaveChange?.(this.octave);
            return;
        }
        const offset = KEYBOARD_NOTE_CODES[event.code];
        if (offset === undefined) return;
        event.preventDefault();
        if (event.repeat || this.held.has(event.code)) return;
        const note = Math.max(0, Math.min(127, (this.octave + 1) * 12 + offset));
        this.held.set(event.code, note);
        this.emit({ type: "noteon", note, velocity: this.velocity, channel: 1, time: event.timeStamp || performance.now() });
    };

    private readonly onKeyUp = (event: KeyboardEvent) => {
        const note = this.held.get(event.code);
        if (note === undefined) return;
        this.held.delete(event.code);
        this.emit({ type: "noteoff", note, velocity: 0, channel: 1, time: event.timeStamp || performance.now() });
    };

    private readonly releaseAll = () => {
        const now = performance.now();
        for (const note of this.held.values()) this.emit({ type: "noteoff", note, velocity: 0, channel: 1, time: now });
        this.held.clear();
    };
}
