import { ApiClient, BibleClient, type BiblePassage, type BibleVersion } from "@youversion/platform-core";

// PUBLIC BY DESIGN
// YouVersion intends app keys for client-side distribution
const APP_KEY="RcYLUrApDgLGOyI5AoOyLKyjq7LSz0epal9gpakY7928EgXT";

// TODO: make translation selectable
// requires cache invalidation on versionPromise when this changes
export const VERSION_ID = 111;

const bible = new BibleClient(new ApiClient({ appKey: APP_KEY }));

export function dayOfYear(d = new Date()): number {
    const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 0);
    const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.floor((today - startOfYear) / 86_400_000);
}

export interface Passage {
    text: string;
    reference: string;
    versionTitle: string;
    copyright: string;
}

let versionPromise: Promise<BibleVersion> | undefined;
function getVersion(): Promise<BibleVersion> {
    versionPromise ??= bible.getVersion(VERSION_ID);
    return versionPromise;
}
export async function getPassage(usfm: string): Promise<Passage> {
    const [passage, version] = await Promise.all([
        bible.getPassage(VERSION_ID, usfm, "text"),
        getVersion(),
    ]);
    return {
        text: passage.content,
        reference: passage.reference,
        versionTitle: version.localized_title,
        copyright: version.copyright ?? `© ${version.title}`,
    };
}

export async function getVerseOfTheDay(): Promise<Passage> {
    const votd = await bible.getVOTD(dayOfYear());
    return getPassage(votd.passage_id);
}