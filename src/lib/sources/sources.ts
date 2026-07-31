// the only places the app will send a reader to read further
//
// ids go to Rust as the allowlist and validate_insight rejects anything else
// these do NOT ground the history
// the detail a reader sees is model written and these are only where to go afterwards
//
// all four terms were read on July 31 2026 and none asks for a notice to link out
// each forbids scraping so nothing here is fetched and every url goes to the user's own browser
// every url below was opened with a real reference rather than guessed
export interface Source {
    id: string;
    name: string;
    // sent to the model so it picks on what a source is for rather than on the sound of its id
    covers: string;
    // a readable reference like "John 3:16" because these are searches
    // a USFM code returns nothing, which is what the first version of this got wrong
    url: (reference: string) => string;
}

export const SOURCES: Source[] = [
    {
        id: "bibleodyssey",
        name: "Bible Odyssey",
        covers: "peer reviewed articles by named scholars on history, archaeology and setting",
        url: (reference) => `https://www.bibleodyssey.org/?s=${encodeURIComponent(reference)}`,
    },
    {
        id: "netbible",
        name: "NET Bible",
        covers: "translators' notes on wording, textual variants and translation choices",
        // the path takes a readable reference and normalises a verse to its chapter
        url: (reference) => `https://netbible.org/bible/${reference.replace(/\s+/g, "+")}`,
    },
    {
        id: "bibleproject",
        name: "BibleProject",
        covers: "literary design, themes running across books, and how a book is put together",
        url: (reference) => `https://bibleproject.com/search/?q=${encodeURIComponent(reference)}`,
    },
    {
        id: "blueletterbible",
        name: "Blue Letter Bible",
        covers: "original language words, lexicons, concordance and cross references",
        url: (reference) => `https://www.blueletterbible.org/search.cfm?Criteria=${encodeURIComponent(reference)}`,
    },
];

// what the model is shown, so an id it has never seen still means something
export const SOURCE_CATALOG = SOURCES.map((s) => `${s.id}: ${s.covers}`);

export const SOURCE_IDS = SOURCES.map((s) => s.id);

export function sourceById(id: string): Source | undefined {
    return SOURCES.find((s) => s.id === id);
}
