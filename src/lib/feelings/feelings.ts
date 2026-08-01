export type FeelingId =
<<<<<<< HEAD
    | "anxious"
    | "weary"
    | "discouraged"
    | "overwhelmed"
    | "restless"
    | "unmotivated"
    | "lonely"
    | "distant"
    | "afraid"
    | "angry"
    | "unforgiving"
    | "grieving";

// the label is what you see and what the model is told, the id is what the
// shelf stores, so rewriting a label retitles every chip that used it
//
// there is no free-text field here, so this list is the darkest thing a reader can say
// everything on it is a feeling scripture answers, and none of it names a crisis
// ordered from the most everyday to the heaviest, for someone already having a bad day
export const FEELINGS: Record<FeelingId, string> = {
    anxious: "Anxious",
    weary: "Weary",
    discouraged: "Discouraged",
    overwhelmed: "Overwhelmed",
    restless: "Restless",
    unmotivated: "Unmotivated",
    lonely: "Lonely",
    distant: "Distant",
    afraid: "Afraid",
    angry: "Angry",
    unforgiving: "Unforgiving",
    grieving: "Grieving",
=======
    | "unforgiving"
    | "lonely"
    | "unmotivated";

// the label is what you see and what the model is told, the id is what the
// shelf stores, so rewriting a label retitles every chip that used it
export const FEELINGS: Record<FeelingId, string> = {
    unforgiving: "Unforgiving",
    lonely: "Lonely",
    unmotivated: "Unmotivated",
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
};

export const FEELING_IDS = Object.keys(FEELINGS) as FeelingId[];
