import { invoke } from "@tauri-apps/api/core";

// reminders and peeks come around in seconds rather than hours, for the video
export const DEMO_MODE = true;

// behavior logging, and an outline on every rect His window publishes as clickable
export const DEBUG = false;

const FLUSH_MS = 1200;
let pending: string[] = [];
let queued = false;

// batched because a per-line IPC crossing costs 1.4ms inside the frame loop
// these lines are measuring
function flush(): void {
    queued = false;
    if (!pending.length) return;
    const lines = pending;
    pending = [];
    invoke("debug_log", { lines }).catch(() => {});
}

export function reportErrors(): void {
    function send(line: string): void {
        console.error(line);
        invoke("debug_log", { lines: [line] }).catch(() => {});
    }

    window.addEventListener("error", (e) => {
        send(`[error] ${e.message} (${e.filename}:${e.lineno}:${e.colno})`);
    });

    window.addEventListener("unhandledrejection", (e) => {
        const reason = e.reason instanceof Error
            ? `${e.reason.message}\n${e.reason.stack ?? ""}`
            : String(e.reason);
        send(`[rejected] ${reason}`);
    });
}

export function trace(msg: string): void {
    if (!DEBUG) return;
    const line = `${(performance.now() / 1000).toFixed(2)} ${msg}`;
    pending.push(line);
    console.log(line);
    if (!queued) {
        queued = true;
        setTimeout(flush, FLUSH_MS);
    }
}
