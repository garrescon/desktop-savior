import { load, save } from "$lib/store";

export interface Item {
    id: string;
    text: string;
    completedOn: string | null;     // dayKey
}

export type Pool = Item[];

const STORAGE_KEY = "desktop-savior:todo:v1";

export const MAX_TEXT = 120;

let seq = 0;
function nextId(): string {
    return `${Date.now().toString(36)}-${seq++}`;
}

export function loadPool(): Pool {
    return load(STORAGE_KEY, (raw) => {
        if (!Array.isArray(raw)) return [];
        const pool: Pool = [];
        for (const value of raw) {
            if (!value || typeof value !== "object") continue;
            const item = value as Partial<Item>;
            if (typeof item.id !== "string" || typeof item.text !== "string") continue;
            pool.push({
                id: item.id,
                text: item.text,
                completedOn: typeof item.completedOn === "string" ? item.completedOn : null,
            });
        }
        return pool;
    }, () => []);
}

export function savePool(pool: Pool): void {
    save(STORAGE_KEY, pool);
}

export function add(pool: Pool, text: string): Pool {
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (!trimmed) return pool;
    return [...pool, { id: nextId(), text: trimmed, completedOn: null }];
}

export function remove(pool: Pool, id: string): Pool {
    return pool.filter((item) => item.id !== id);
}

export function toggle(pool: Pool, id: string, day: string): Pool {
    return pool.map((item) =>
        item.id === id
            ? { ...item, completedOn: item.completedOn === day ? null : day }
            : item,
    );
}

export function doneOn(pool: Pool, day: string): number {
    return pool.filter((item) => item.completedOn === day).length;
}
