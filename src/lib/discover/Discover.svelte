<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { openUrl } from "@tauri-apps/plugin-opener";
    import Passages, { type Entry } from "$lib/shelf/Passages.svelte";
    import { getCachedPassage } from "$lib/youversion/cache";
    import { SOURCE_IDS, SOURCE_CATALOG, sourceById } from "$lib/sources/sources";
    import { loadSettings } from "$lib/settings/settings";
    import { loadShelf, saveShelf, keep, annotate, isKept } from "$lib/shelf/shelf";
    import { MAX_SPAN, type Reading } from "$lib/reading/plan";
    import type { Book } from "$lib/youversion/api";
    import { ASPECTS } from "./aspects";

    interface Insight {
        detail: string;
        references: string[];
        sources: string[];
    }

    let { books, book, reading }: {
        books: Book[];
        book: string;
        reading: Reading | null;
    } = $props();

    // seeded from the plan and owned here after that
    // switching books in settings must not move a passage someone is part way through
    // svelte-ignore state_referenced_locally
    let chosen = $state(book);
    let chapter = $state(1);
    let verse = $state(1);
    // empty is a single verse rather than a range
    let verseTo = $state<number | null>(null);

    let shelf = $state(loadShelf());
    let keeping = $state<string | null>(null);
    let draft = $state("");

    let detail = $state<string | null>(null);
    let related = $state<Entry[]>([]);
    let sources = $state<string[]>([]);
    let asked = $state<string | null>(null);
    let asking = $state(false);
    let failed = $state(false);

    const first = $derived(Math.max(1, verse));
    // a range only when the end is past the start and inside the span gloo will accept
    const last = $derived(
        verseTo && verseTo > first && verseTo - first < MAX_SPAN ? verseTo : 0,
    );
    const span = $derived(last ? `${first}-${last}` : `${first}`);

    // every field is a number or a book code so the reference can only ever be well formed
    const reference = $derived(`${chosen}.${Math.max(1, chapter)}.${span}`);

    // the sources are text searches so they need the name a person would type
    const readable = $derived(
        `${books.find((b) => b.usfm === chosen)?.name ?? chosen} ${Math.max(1, chapter)}:${span}`,
    );

    const lens = () => loadSettings().tradition;

    function takeReading() {
        if (!reading) return;
        chosen = book;
        chapter = reading.from.chapter;
        verse = reading.from.verse;
        // only when the reading stays inside one chapter because that is all a reference holds
        verseTo = reading.from.chapter === reading.to.chapter ? reading.to.verse : null;
    }

    function startKeep(usfm: string) {
        draft = "";
        keeping = usfm;
    }

    function cancelKeep() {
        keeping = null;
        draft = "";
    }

    // re-reads first, this shelf has more than one writer
    function commitKeep(entry: Entry) {
        const origin = asked ? { kind: "aspect" as const, ids: [asked] } : undefined;
        let next = keep(loadShelf(), entry.usfm, entry, origin);
        if (draft.trim()) next = annotate(next, entry.usfm, draft);
        shelf = next;
        saveShelf(shelf);
        cancelKeep();
    }

    function keys(event: KeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            cancelKeep();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            const entry = related.find((e) => e.usfm === keeping);
            if (entry) commitKeep(entry);
        }
    }

    function takeFocus(node: HTMLTextAreaElement) {
        node.focus();
    }

    async function ask(aspect: string) {
        asking = true;
        failed = false;
        detail = null;
        related = [];
        sources = [];
        asked = aspect;

        try {
            const insight = await invoke<Insight>("ask_passage", {
                reference,
                aspect,
                sources: SOURCE_IDS,
                catalog: SOURCE_CATALOG,
                tradition: lens(),
            });

            // a reference can be well formed and still 404 so one miss must not cost the rest
            const results = await Promise.allSettled(insight.references.map(getCachedPassage));
            const found: Entry[] = [];
            results.forEach((r, i) => {
                if (r.status === "fulfilled") found.push({ ...r.value, usfm: insight.references[i] });
            });

            detail = insight.detail;
            related = found;
            sources = insight.sources;
        } catch (err) {
            console.error("ask_passage:", err);
            failed = true;
        } finally {
            asking = false;
        }
    }

    function open(id: string) {
        const source = sourceById(id);
        if (source) openUrl(source.url(readable)).catch(console.warn);
    }
</script>

{#snippet keepAction(entry: Entry)}
    {@const kept = isKept(shelf, entry.usfm)}
    <button
        class="keep"
        onclick={() => startKeep(entry.usfm)}
        disabled={kept || keeping === entry.usfm}
    >{kept ? "kept" : "keep this one"}</button>
{/snippet}

<!-- the note is written before the passage is filed so nothing lands on the shelf unexplained -->
{#snippet keepNote(entry: Entry)}
    {#if keeping === entry.usfm}
        <textarea
            class="draft"
            rows="3"
            bind:value={draft}
            onkeydown={keys}
            use:takeFocus
            placeholder="Jot down your thoughts!"
            aria-label="your note on this passage"
        ></textarea>
        <div class="editor-act">
            <button class="quiet" onclick={cancelKeep}>cancel</button>
            <button class="quiet firm" onclick={() => commitKeep(entry)}>save</button>
        </div>
    {/if}
{/snippet}

<div class="discover">
    <div class="picked">
        <select class="picker" bind:value={chosen} disabled={!books.length} aria-label="which book">
            {#each books as entry (entry.usfm)}
                <option value={entry.usfm}>{entry.name}</option>
            {/each}
        </select>

        <input class="num" type="number" min="1" bind:value={chapter} aria-label="chapter" />
        <span class="colon" aria-hidden="true">:</span>
        <input class="num" type="number" min="1" bind:value={verse} aria-label="verse" />
        <span class="dash" aria-hidden="true">–</span>
        <input class="num" type="number" min="1" bind:value={verseTo} aria-label="through verse" />
    </div>

    {#if reading}
        <button class="today" onclick={takeReading}>today's reading</button>
    {/if}

    <div class="pill-wrap">
        {#each ASPECTS as aspect (aspect.id)}
            <button
                class="pill aspect"
                class:selected={asked === aspect.id}
                aria-pressed={asked === aspect.id}
                onclick={() => ask(aspect.id)}
                disabled={asking}
            >{aspect.label}</button>
        {/each}
    </div>

    {#if detail}
        <!-- the label ships with the prose it labels so the two cannot separate -->
        <p class="label">written by AI and not checked</p>
        <p class="detail">{detail}</p>

        {#if sources.length}
            <ul class="sources">
                {#each sources as id}
                    {@const source = sourceById(id)}
                    {#if source}
                        <li><button class="source-link" onclick={() => open(id)}>{source.name}</button></li>
                    {/if}
                {/each}
            </ul>
        {/if}

        {#if related.length}
            <Passages entries={related} action={keepAction} annotation={keepNote} />
        {/if}
    {:else if asking}
        <p class="placeholder">Looking</p>
    {:else if failed}
        <p class="placeholder error">Couldn't reach the library, try again later.</p>
    {/if}
</div>

<style>
    /* the same shape as the settings row so a picker looks like a picker everywhere */
    .picked { display: flex; align-items: center; gap: 6px; }
    .picker {
        flex: 1;
        min-width: 0;
        padding: 8px 9px;
        background: var(--surface);
        border: 1px solid var(--hair-firm);
        border-radius: 0;
        color: var(--walnut);
        font: 400 10.5px/1 var(--body);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
    .picker:disabled { color: rgba(var(--ink), 0.35); cursor: default; }
    /* border-box because the width is a budget the book picker has to share */
    .num {
        flex: none;
        width: 44px;
        box-sizing: border-box;
        padding: 8px 5px;
        background: var(--surface);
        border: 1px solid var(--hair-firm);
        color: var(--walnut);
        font: 400 10.5px/1 var(--body);
        font-variant-numeric: tabular-nums;
        text-align: center;
    }
    /* the app steps numbers with its own buttons, so the native spinners are noise here */
    .num::-webkit-inner-spin-button,
    .num::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .colon, .dash { color: rgba(var(--ink), 0.4); }

    /* .keep is in companion.css */

    /* the same composer the shelf uses, so writing a note feels the same in both places */
    .draft {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        background: var(--paper);
        border: 1px solid var(--hair-firm);
        font: 400 13.5px/1.65 var(--body);
        color: rgba(var(--ink), 0.85);
        resize: vertical;
    }
    .editor-act {
        margin-top: 8px;
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }
    .quiet {
        padding: 6px 8px;
        background: transparent;
        border: none;
        color: rgba(var(--ink), 0.45);
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color var(--tick) ease;
    }
    .quiet:hover { color: var(--maroon); }
    .firm { color: var(--maroon); }

    /* the treatment Bible.com carries, so anything that jumps elsewhere looks alike */
    .today,
    .source-link {
        padding: 0;
        background: transparent;
        border: none;
        color: var(--maroon);
        font: italic 400 12px/1.4 var(--body);
        text-decoration: underline;
        cursor: pointer;
    }
    .today { margin-top: 10px; }

    /* .pill and .pill-wrap are in companion.css, this is only the distance above them */
    .pill-wrap { margin-top: 16px; }

    /* louder than the prose it heads because it is the reason to doubt it */
    .label {
        margin: 20px 0 6px;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--maroon);
    }
    .detail {
        margin: 0;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.68);
        text-wrap: pretty;
    }

    .sources { margin: 14px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 14px; }

    .placeholder {
        margin: 20px 0 0;
        font: italic 400 15px/1.7 var(--display);
        color: rgba(var(--ink), 0.45);
        text-wrap: pretty;
    }
    /* scoped so it outranks .placeholder, which Svelte also scopes */
    .error { color: rgba(var(--red), 0.65); }
</style>
