import type { Ticker } from "./types.ts";

export const TICK_INTERVAL_MS = 25;

/** Ticks from a Web Worker; falls back to setInterval where workers aren't available. */
export class WorkerTicker implements Ticker {
    private worker: Worker | null = null;
    private fallback: ReturnType<typeof setInterval> | null = null;
    private callback: (() => void) | null = null;
    private readonly intervalMs: number;

    constructor(intervalMs = TICK_INTERVAL_MS) {
        this.intervalMs = intervalMs;
    }

    start(callback: () => void): void {
        this.callback = callback;
        if (typeof Worker !== "undefined") {
            try {
                if (!this.worker) {
                    this.worker = new Worker(new URL("./tickWorker.ts", import.meta.url), { type: "module" });
                    this.worker.onmessage = () => this.callback?.();
                }
                this.worker.postMessage({ type: "start", intervalMs: this.intervalMs });
                return;
            } catch {
                this.worker = null;
            }
        }
        if (this.fallback === null) this.fallback = setInterval(() => this.callback?.(), this.intervalMs);
    }

    stop(): void {
        this.callback = null;
        this.worker?.postMessage({ type: "stop" });
        if (this.fallback !== null) {
            clearInterval(this.fallback);
            this.fallback = null;
        }
    }

    dispose(): void {
        this.stop();
        this.worker?.terminate();
        this.worker = null;
    }
}
