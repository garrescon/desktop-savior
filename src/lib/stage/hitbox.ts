import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEBUG } from "$lib/dev";

// Rust treats silence past its own timeout as a wedged webview and falls back to
// click-through, so publishing keeps happening even when nothing has moved.
const HEARTBEAT_MS = 5_000;

let savior: boolean | null = null;
function isSaviorWindow(): boolean {
    if (savior === null) {
        try {
            savior = getCurrentWindow().label === "main";
        } catch {
            savior = false;
        }
    }
    return savior;
}

const nodes = new Map<number, HTMLElement>();
let nextId = 0;
let pending = false;
let heartbeat: ReturnType<typeof setInterval> | undefined;

function publish() {
    const rects = [];
    for (const node of nodes.values()) {
        const box = node.getBoundingClientRect();
        // a node mid-transition can measure zero; Rust reads an empty list as
        // "nothing is clickable", which is not what a collapsed element means
        if (box.width > 0 && box.height > 0) {
            rects.push({ x: box.x, y: box.y, w: box.width, h: box.height });
        }
    }
    invoke("set_hit_rects", { rects }).catch(console.warn);
}

function refresh() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        publish();
    });
}

// registers an element as somewhere His window should accept clicks
export function hitbox(node: HTMLElement) {
    if (!isSaviorWindow()) return;

    const id = nextId++;
    nodes.set(id, node);

    if (DEBUG) node.style.outline = "1px dashed magenta";

    const observer = new ResizeObserver(refresh);
    observer.observe(node);
    window.addEventListener("resize", refresh);

    heartbeat ??= setInterval(publish, HEARTBEAT_MS);
    refresh();

    return {
        destroy() {
            observer.disconnect();
            window.removeEventListener("resize", refresh);
            nodes.delete(id);
            if (DEBUG) node.style.outline = "";

            if (nodes.size === 0) {
                clearInterval(heartbeat);
                heartbeat = undefined;
                // nothing is clickable now
                publish();
            } else {
                refresh();
            }
        },
    };
}
