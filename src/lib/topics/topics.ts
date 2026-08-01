// the subjects a reader can ask to read about
// ids mirror TOPICS in gloo.rs, which rejects anything not on that list
export type TopicId =
    | "forgiveness"
    | "gratitude"
    | "prayer"
    | "wisdom"
    | "humility"
    | "obedience"
    | "generosity"
    | "perseverance"
    | "temptation"
    | "doubt"
    | "suffering"
    | "purpose";

// unlike FEELINGS, the id is what the model is sent and the label is only what you see
// so rewriting one of these changes the button and nothing else
//
// these are subjects to study rather than moods to answer, which keeps them clear of FEELINGS
// they are not attributes of His either, which keeps them clear of REMINDERS
// forgiveness is the one word that appears in both places
export const TOPICS: Record<TopicId, string> = {
    forgiveness: "Forgiveness",
    gratitude: "Gratitude",
    prayer: "Prayer",
    wisdom: "Wisdom",
    humility: "Humility",
    obedience: "Obedience",
    generosity: "Generosity",
    perseverance: "Perseverance",
    temptation: "Temptation",
    doubt: "Doubt",
    suffering: "Suffering",
    purpose: "Purpose",
};

export const TOPIC_IDS = Object.keys(TOPICS) as TopicId[];
