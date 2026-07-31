export type FeelingId =
    | "unforgiving"
    | "lonely"
    | "unmotivated";

// the label is what you see and what the model is told, the id is what the
// shelf stores, so rewriting a label retitles every chip that used it
export const FEELINGS: Record<FeelingId, string> = {
    unforgiving: "Unforgiving",
    lonely: "Lonely",
    unmotivated: "Unmotivated",
};

export const FEELING_IDS = Object.keys(FEELINGS) as FeelingId[];
