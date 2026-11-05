// Web Worker that posts "tick" about every 25 ms.
// Worker timers aren't throttled when the tab is covered by another window (e.g. a DAW).

interface WorkerScope {
    postMessage(message: unknown): void;
    onmessage: ((event: MessageEvent<{ type: "start" | "stop"; intervalMs?: number }>) => void) | null;
}

const scope = self as unknown as WorkerScope;
let timer: ReturnType<typeof setInterval> | null = null;

scope.onmessage = (event) => {
    if (event.data.type === "start") {
        if (timer !== null) clearInterval(timer);
        timer = setInterval(() => scope.postMessage("tick"), event.data.intervalMs ?? 25);
    } else if (timer !== null) {
        clearInterval(timer);
        timer = null;
    }
};
