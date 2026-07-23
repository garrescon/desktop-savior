export type ReminderTheme = "love";     // | "strength" | "peace"

export interface ReminderDef {
    label: string;
    breath: string;
    exit: string;
    refs: string[];
}

export const REMINDERS: Record<ReminderTheme, ReminderDef> = {
    love: {
        label: "Love",
        breath: "[breath]",
        exit: "OK!!!",
        refs: ["JHN.3.16", "ROM.5.8", "ZEP.3.17", "1JN.4.9"],   // placeholder
    },
};
