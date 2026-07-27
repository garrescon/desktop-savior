export const HABITS = ["Bible", "Pray", "Connect"] as const;
export type HabitName = (typeof HABITS)[number];
export type HabitLog = Record<HabitName, string[]>;

const STORAGE_KEY = "desktop-savior:habits";

// local calendar day
export function dayKey(date = new Date()): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");  // getMonth is 0-based
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function emptyLog(): HabitLog {
    const log = {} as HabitLog;
    for (const name of HABITS) log[name] = [];
    return log;
}

export function loadLog(): HabitLog {
    const log = emptyLog();
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return log;

        const parsed = JSON.parse(stored) as Partial<HabitLog>;
        // check for the shape that would break the caller
        for (const name of HABITS) {
            const days = parsed?.[name];
            if (Array.isArray(days)) log[name] = days;
        }
    } catch {
        // start the checkboxes over rather than break
    }
    return log;
}

export function saveLog(log: HabitLog): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

// day is passed so it can backfill a missed day
export function toggle(log: HabitLog, name: HabitName, day: string): HabitLog {
    const days = log[name];
    return {
        ...log,
        [name]: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    };
}
