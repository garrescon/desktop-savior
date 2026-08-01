<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { loadSettings } from "$lib/settings/settings";
    import { bookOf, inPlans, type Plan } from "$lib/reading/plan";
    import type { Book } from "$lib/youversion/api";
    import { TOPICS, TOPIC_IDS, type TopicId } from "./topics";

    // nothing here fetches scripture, it points at a reading and hands it to the plan
    // the reading itself happens in the book
    let { plan, books, onAdd }: {
        plan: Plan;
        books: Book[];
        onAdd: (book: string) => void;
    } = $props();

    // keep in sync with the Guidance struct in src-tauri/src/gloo.rs
    interface Guidance { references: string[]; note: string; }

    let selected = $state<TopicId[]>([]);
    let note = $state<string | null>(null);
    let refs = $state<string[]>([]);
    let asking = $state(false);
    let failed = $state(false);

    function toggle(topic: TopicId) {
        selected = selected.includes(topic)
            ? selected.filter((t) => t !== topic)
            : [...selected, topic];
    }

    // PRO.3.5-6 -> Proverbs 3:5-6, the same way a citation reads everywhere else
    function label(usfm: string): string {
        const [book, chapter, verses] = usfm.split(".");
        const name = books.find((b) => b.usfm === book)?.name ?? book;
        return `${name} ${chapter}:${verses}`;
    }

    async function ask() {
        asking = true;
        failed = false;
        note = null;
        refs = [];
        try {
            // the ids go up rather than the labels, so a reworded button asks for the same thing
            const guidance = await invoke<Guidance>("ask_topic", {
                topics: [...selected],
                tradition: loadSettings().tradition,
            });

            // gloo.rs has already dropped anything malformed or over-long
            // so these render as citations without asking YouVersion for the text
            refs = guidance.references;
            note = guidance.note;
        } catch (err) {
            console.error("ask_topic:", err);
            failed = true;
        } finally {
            asking = false;
        }
    }
</script>

<div class="topics">
    <p class="lede">What would you like to read about?</p>

    <div class="pill-wrap">
        {#each TOPIC_IDS as id (id)}
            <button
                class="pill"
                class:selected={selected.includes(id)}
                aria-pressed={selected.includes(id)}
                onclick={() => toggle(id)}
                disabled={asking}
            >{TOPICS[id]}</button>
        {/each}
    </div>

    <button class="ask" onclick={ask} disabled={asking || selected.length === 0}>
        {selected.length ? "Find passages" : "Pick a subject first"}
    </button>

    {#if note}
        <p class="note">{note}</p>
    {/if}

    {#if refs.length}
        <ul class="found">
            {#each refs as usfm (usfm)}
                {@const already = inPlans(plan, bookOf(usfm))}
                <li>
                    <cite>{label(usfm)}</cite>
                    <button class="keep add" onclick={() => onAdd(bookOf(usfm))} disabled={already}>
                        {already ? "In your plans" : "Add to plans"}
                    </button>
                </li>
            {/each}
        </ul>
    {:else if asking}
        <p class="placeholder">Looking</p>
    {:else if failed}
        <p class="placeholder error">Couldn't reach the library, try again later.</p>
    {/if}
</div>

<style>
    /* .pill and .pill-wrap are in companion.css, this is only the distance above them */
    .pill-wrap { margin-top: 14px; }

    /* the same full-width action the feelings ask uses */
    .ask {
        width: 100%;
        margin-top: 16px;
        padding: 13px;
        background: transparent;
        color: var(--walnut);
        border: 1px solid var(--walnut);
        font: 400 12px/1 var(--body);
        letter-spacing: 0.22em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .ask:hover:not(:disabled) { background: rgba(var(--ink), 0.08); }
    .ask:disabled {
        color: rgba(var(--ink), 0.4);
        border-color: var(--hair-firm);
        cursor: default;
    }

    .found { margin: 16px 0 0; padding: 0; list-style: none; }
    .found li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 11px 0;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
    }
    /* the reference is the recommendation, so it carries the weight here */
    .found cite {
        font: 400 15px/1.3 var(--display);
        font-style: normal;
        color: var(--walnut);
        font-variant-numeric: tabular-nums;
    }
    /* .keep in companion.css carries the look, this is what a row needs on top */
    .add {
        flex: none;
        padding: 7px 11px;
        white-space: nowrap;
    }

    .lede {
        margin: 0;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.7);
        text-wrap: pretty;
    }
    /* gloo's note, the same treatment it gets beside a feeling */
    .note {
        margin: 20px 0 0;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.68);
        text-wrap: pretty;
    }
    .placeholder {
        margin: 20px 0 0;
        font: italic 400 15px/1.7 var(--display);
        color: rgba(var(--ink), 0.45);
        text-wrap: pretty;
    }
    /* scoped so it outranks .placeholder, which Svelte also scopes */
    .error { color: rgba(var(--red), 0.65); }
</style>
