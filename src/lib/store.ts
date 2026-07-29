// persisted state that survives a bad parse

export function load<T>(key: string, revive: (raw: unknown) => T, fallback: () => T): T {
    try {
        const stored = localStorage.getItem(key);
        return stored ? revive(JSON.parse(stored)) : fallback();
    } catch {
        return fallback();
    }
}

export function save(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
}

// rounds since everything is a whole number
export function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.round(n)));
}

// anything that isn't a number reads as none
export function whole(value: unknown): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
}
