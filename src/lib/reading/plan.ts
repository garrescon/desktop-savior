import type { ChapterLength } from "$lib/youversion/api";
import { load, save, clamp, whole } from "$lib/store";

export const PLAN_BOOK = "LUK";
export const PLAN_BOOK_NAME = "Luke";

export const MIN_PACE = 1, MAX_PACE = 40, DEFAULT_PACE = 10;

// progress is a count of verses read from the book's start
export interface Plan {
    versesRead: number;
    pace: number;
}

const STORAGE_KEY = "desktop-savior:reading";

// TODO: no way to start over. Luke can only be read once in your life. Memorize it well.

function defaultPlan(): Plan {
    return { versesRead: 0, pace: DEFAULT_PACE };
}

export function loadPlan(): Plan {
    return load(STORAGE_KEY, (raw) => {
        const parsed = raw as Partial<Plan>;
        const plan = defaultPlan();
        // clamp rather than reject
        plan.versesRead = whole(parsed?.versesRead);
        if (Number.isFinite(parsed?.pace)) plan.pace = clamp(parsed!.pace!, MIN_PACE, MAX_PACE);
        return plan;
    }, defaultPlan);
}

export function savePlan(plan: Plan): void {
    save(STORAGE_KEY, plan);
}

export function setPace(plan: Plan, delta: number): Plan {
    return { ...plan, pace: clamp(plan.pace + delta, MIN_PACE, MAX_PACE) };
}

// bookmark moves by whatever today's count moved by
export function advance(plan: Plan, delta: number, total: number): Plan {
    return { ...plan, versesRead: Math.max(0, Math.min(total, plan.versesRead + delta)) };
}

export function totalVerses(lengths: ChapterLength[]): number {
    return lengths.reduce((sum, c) => sum + c.verses, 0);
}

export interface Reading {
    from: { chapter: number; verse: number };
    to: { chapter: number; verse: number };
    count: number;
    label: string;
    // the start verse only
    startUsfm: string;
}

function locate(lengths: ChapterLength[], offset: number) {
    let left = offset;
    for (const { chapter, verses } of lengths) {
        if (left <= verses) return { chapter, verse: left };
        left -= verses;
    }
    return null;
}

export function readingFor(lengths: ChapterLength[], versesRead: number, pace: number): Reading | null {
    const total = totalVerses(lengths);
    const start = versesRead + 1;
    if (!lengths.length || start > total) return null;   // book finished

    const end = Math.min(versesRead + pace, total);
    const from = locate(lengths, start);
    const to = locate(lengths, end);
    // unreachable after the bounds check above
    if (!from || !to) return null;

    return {
        from,
        to,
        count: end - start + 1,
        label: from.chapter === to.chapter
            ? `${from.chapter}:${from.verse}–${to.verse}`
            : `${from.chapter}:${from.verse}–${to.chapter}:${to.verse}`,
        startUsfm: `${PLAN_BOOK}.${from.chapter}.${from.verse}`,
    };
}

// setDate past the month's end rolls over on its own, and stays in local time
// like dayKey()
export function finishedBy(remaining: number, pace: number, from = new Date()): Date {
    const date = new Date(from);
    date.setDate(date.getDate() + Math.ceil(remaining / pace));
    return date;
}