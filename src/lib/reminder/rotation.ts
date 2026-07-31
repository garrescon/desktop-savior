import type { ReminderTheme } from "./themes";

export function shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

interface Bag {
    source: readonly string[];
    remaining: string[];
    last?: string;
}

const bags = new Map<ReminderTheme, Bag>();

export function nextRef(theme: ReminderTheme, pool: readonly string[]): string | null {
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];

    let bag = bags.get(theme);
    // an edited pool is a new array so the bag rebuilds against it
    if (!bag || bag.source !== pool) {
        bag = { source: pool, remaining: [] };
        bags.set(theme, bag);
    }

    if (!bag.remaining.length) {
        bag.remaining = shuffle(pool);
        // a reshuffle could otherwise hand back the verse that just played
        const end = bag.remaining.length - 1;
        if (bag.last !== undefined && bag.remaining[end] === bag.last) {
            [bag.remaining[end], bag.remaining[0]] = [bag.remaining[0], bag.remaining[end]];
        }
    }

    const ref = bag.remaining.pop() as string;
    bag.last = ref;
    return ref;
}
