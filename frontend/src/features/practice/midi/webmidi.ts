import { WebMidi, type Input, type MessageEvent as WebMidiMessageEvent, type Output } from "webmidi";
import { parseMidiMessage } from "./parse.ts";
import type { InputListener, InputSource, OutputSink } from "./types.ts";

export type MidiStatus =
    /** No Web MIDI in this browser (e.g. Safari). */
    | "unsupported"
    /** Web MIDI needs https (or localhost). */
    | "insecure"
    | "idle"
    /** The browser will ask for permission when we request access. */
    | "prompt"
    | "requesting"
    | "denied"
    | "ready"
    | "error";

export interface MidiPortInfo {
    id: string;
    name: string;
    manufacturer: string;
}

export interface MidiState {
    status: MidiStatus;
    inputs: MidiPortInfo[];
    outputs: MidiPortInfo[];
    error: string | null;
}

function portInfo(port: Input | Output): MidiPortInfo {
    return { id: port.id, name: port.name, manufacturer: port.manufacturer };
}

/** Owns Web MIDI access and the device lists. One instance for the whole app. */
export class MidiManager {
    private state: MidiState = { status: "idle", inputs: [], outputs: [], error: null };
    private listeners = new Set<() => void>();
    private initPromise: Promise<void> | null = null;
    private readonly inputs = new Map<string, SelectedMidiInput>();

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getState = (): MidiState => this.state;

    private setState(patch: Partial<MidiState>): void {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) listener();
    }

    /** Checks support and permission; enables right away when permission was granted before. */
    init(): Promise<void> {
        if (!this.initPromise) this.initPromise = this.doInit();
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        if (typeof window !== "undefined" && window.isSecureContext === false) {
            this.setState({ status: "insecure" });
            return;
        }
        if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
            this.setState({ status: "unsupported" });
            return;
        }
        let permission: PermissionState | "unknown" = "unknown";
        try {
            const result = await navigator.permissions.query({ name: "midi" as PermissionName });
            permission = result.state;
            result.addEventListener("change", () => {
                if (result.state === "denied") this.setState({ status: "denied" });
                else if (result.state === "granted" && this.state.status !== "ready") void this.enable();
            });
        } catch {
            permission = "unknown";
        }
        if (permission === "granted") await this.enable();
        else if (permission === "denied") this.setState({ status: "denied" });
        else this.setState({ status: "prompt" });
    }

    /** Requests MIDI access (shows the browser's permission prompt if needed). */
    async enable(): Promise<void> {
        if (this.state.status === "ready" || this.state.status === "unsupported" || this.state.status === "insecure") return;
        this.setState({ status: "requesting", error: null });
        try {
            await WebMidi.enable({ sysex: false });
        } catch (error) {
            const name = error instanceof Error ? error.name : "";
            if (name === "SecurityError" || name === "NotAllowedError") {
                this.setState({ status: "denied" });
            } else {
                this.setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
            }
            return;
        }
        WebMidi.addListener("connected", this.refresh);
        WebMidi.addListener("disconnected", this.refresh);
        this.setState({ status: "ready" });
        this.refresh();
    }

    private readonly refresh = () => {
        if (!WebMidi.enabled) return;
        this.setState({
            inputs: WebMidi.inputs.filter((p) => p.state !== "disconnected").map(portInfo),
            outputs: WebMidi.outputs.filter((p) => p.state !== "disconnected").map(portInfo),
        });
        for (const input of this.inputs.values()) input.reattach();
    };

    findOutput(name: string | null): Output | null {
        if (!name || !WebMidi.enabled) return null;
        return WebMidi.outputs.find((p) => p.name === name && p.state !== "disconnected") ?? null;
    }

    findInput(name: string | null): Input | null {
        if (!name || !WebMidi.enabled) return null;
        return WebMidi.inputs.find((p) => p.name === name && p.state !== "disconnected") ?? null;
    }

    /** An output sink for the device with this name, or null when it isn't connected. */
    outputSink(name: string | null): OutputSink | null {
        const output = this.findOutput(name);
        return output ? new WebMidiOutputSink(output) : null;
    }

    /** A stable input source for a device name; it follows the device through disconnects. */
    inputSource(name: string): InputSource {
        let source = this.inputs.get(name);
        if (!source) {
            source = new SelectedMidiInput(name, this);
            this.inputs.set(name, source);
        }
        return source;
    }

    /** Time on the MIDI clock (same as performance.now()). */
    now(): number {
        return WebMidi.enabled ? WebMidi.time : performance.now();
    }
}

export class WebMidiOutputSink implements OutputSink {
    private readonly output: Output;

    constructor(output: Output) {
        this.output = output;
    }

    get name(): string {
        return this.output.name;
    }

    send(data: number[], time?: number): void {
        try {
            this.output.send(data, time === undefined ? undefined : { time });
        } catch {
            // The port went away mid-send; the device list will update on its own.
        }
    }
}

/** Forwards messages from the connected port with a given name. */
class SelectedMidiInput implements InputSource {
    readonly id: string;
    readonly name: string;
    private readonly manager: MidiManager;
    private listeners = new Set<InputListener>();
    private port: Input | null = null;

    constructor(name: string, manager: MidiManager) {
        this.id = `midi:${name}`;
        this.name = name;
        this.manager = manager;
    }

    subscribe(listener: InputListener): () => void {
        this.listeners.add(listener);
        this.reattach();
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) this.detach();
        };
    }

    reattach(): void {
        const port = this.listeners.size > 0 ? this.manager.findInput(this.name) : null;
        if (port === this.port) return;
        this.detach();
        if (port) {
            port.addListener("midimessage", this.onMessage);
            this.port = port;
        }
    }

    private detach(): void {
        this.port?.removeListener("midimessage", this.onMessage);
        this.port = null;
    }

    private readonly onMessage = (event: WebMidiMessageEvent) => {
        const parsed = parseMidiMessage(event.rawData ?? event.data, event.timestamp);
        if (!parsed) return;
        for (const listener of this.listeners) listener(parsed);
    };
}

export const midiManager = new MidiManager();
