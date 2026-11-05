import type { InputListener, InputSource } from "./types.ts";

/** Merges several input sources (MIDI port + computer keyboard) into one. */
export class InputHub implements InputSource {
    readonly id = "input-hub";
    readonly name = "All inputs";
    private listeners = new Set<InputListener>();
    private sources: InputSource[] = [];
    private unsubscribers: Array<() => void> = [];

    setSources(sources: InputSource[]): void {
        const same = sources.length === this.sources.length && sources.every((s, i) => s === this.sources[i]);
        if (same) return;
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.sources = sources;
        this.unsubscribers = sources.map((source) => source.subscribe((event) => this.emit(event)));
    }

    subscribe(listener: InputListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: Parameters<InputListener>[0]): void {
        for (const listener of this.listeners) listener(event);
    }

    dispose(): void {
        for (const unsubscribe of this.unsubscribers) unsubscribe();
        this.unsubscribers = [];
        this.sources = [];
        this.listeners.clear();
    }
}
