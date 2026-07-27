import type { ChapterLength } from "$lib/youversion/api";

export const PLAN_BOOK = "LUK";
export const PLAN_BOOK_NAME = "Luke";

export const MIN_PACE = 1, MAX_PACE = 40, DEFAULT_PACE = 10;

// progress is a count of verses read from the book's start
export interface Plan {
    versesRead: number;
    pace: number;
    // what the last mark added, so undo stays correct after a pace change
    lastRead: { day: string; count: number } | null;
}

const STORAGE_KEY = "desktop-savior:reading";

// TODO: no way to start over. Luke can only be read once in your life. Memorize it well.

function clampPace(n: number): number {
    return Math.min(MAX_PACE, Math.max(MIN_PACE, Math.round(n)));
}

function defaultPlan(): Plan {
    return { versesRead: 0, pace: DEFAULT_PACE, lastRead: null };
}

export function loadPlan(): Plan {
    const plan = defaultPlan();
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return plan;

        const parsed = JSON.parse(stored) as Partial<Plan>;
        // clamp rather than reject
        if (Number.isFinite(parsed?.versesRead)) plan.versesRead = Math.max(0, Math.floor(parsed!.versesRead!));
        if (Number.isFinite(parsed?.pace)) plan.pace = clampPace(parsed!.pace!);

        const last = parsed?.lastRead;
        if (last && typeof last.day === "string" && Number.isFinite(last.count)) {
            plan.lastRead = { day: last.day, count: Math.max(0, Math.floor(last.count)) };
        }
    } catch {
        // start the plan over rather than break
    }
    return plan;
}

export function savePlan(plan: Plan): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export function setPace(plan: Plan, delta: number): Plan {
    return { ...plan, pace: clampPace(plan.pace + delta) };
}

export function markRead(plan: Plan, day: string, count: number): Plan {
    return { ...plan, versesRead: plan.versesRead + count, lastRead: { day, count } };
}

export function undoRead(plan: Plan): Plan {
    if (!plan.lastRead) return plan;
    return {
        ...plan,
        versesRead: Math.max(0, plan.versesRead - plan.lastRead.count),
        lastRead: null,
    };
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