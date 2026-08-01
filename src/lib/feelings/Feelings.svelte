<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { getCachedPassage } from "$lib/youversion/cache";
    import Passages, { type Entry } from "$lib/shelf/Passages.svelte";
    import { loadShelf, saveShelf, keep, isKept } from "$lib/shelf/shelf";
    import { FEELINGS, FEELING_IDS, type FeelingId } from "./feelings";
<<<<<<< HEAD
    import { loadSettings } from "$lib/settings/settings";
=======
    import { loadSettings } from "$lib/day/progress";
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764

    // keep in sync with Guidance struct in src-tauri/src/gloo.rs
    interface Guidance { references: string[]; note: string; }

    // this component is unmounted on exit so it clears
    let selected = $state<FeelingId[]>([]);

    // what produced the results on screen because the pills stay live after an ask
    let askedWith = $state<FeelingId[]>([]);
    let note = $state<string | null>(null);
    let entries = $state<Entry[]>([]);
    let asking = $state(false);
    let askError = $state<string | null>(null);

    // so a passage already kept says so rather than offering to keep it twice
    let shelf = $state(loadShelf());

    const prompt = $derived(
        selected.length
            ? "Pick as many as you'd like."
            : "How do you feel?",
    );

    function toggleFeeling(feeling: FeelingId) {
        selected = selected.includes(feeling)
            ? selected.filter((f) => f !== feeling)
            : [...selected, feeling];
    }

    // re-reads first, this shelf has more than one writer
    function keepIt(entry: Entry) {
        shelf = keep(loadShelf(), entry.usfm, entry, { kind: "feeling", ids: askedWith });
        saveShelf(shelf);
    }

    async function ask() {
        asking = true;
        askError = null;
        note = null;
        entries = [];
        const asked = [...selected];
        try {
            // the model is told the words and not the ids
<<<<<<< HEAD
=======
            // the tradition is re-read because settings live in the other tab
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
            const guidance = await invoke<Guidance>("ask_gloo", {
                feelings: asked.map((id) => FEELINGS[id]),
                tradition: loadSettings().tradition,
            });

            // verses_in checks a reference's shape, not that it exists, so a well-formed
            // invention reaches YouVersion and 404s there
            // one of those shouldn't cost the references that did come back
            const refs = guidance.references;
            const results = await Promise.allSettled(refs.map(getCachedPassage));

            // allSettled preserves order, so the index still names the reference
            const found: Entry[] = [];
            results.forEach((r, i) => {
                if (r.status === "fulfilled") found.push({ ...r.value, usfm: refs[i] });
            });

            const missing = results.length - found.length;
            if (missing) console.warn(`feelings: ${missing}/${results.length} references unavailable`);

            // a note with no scripture beside it is the app speaking on its own
            if (!found.length) throw new Error("no references resolved");

            entries = found;
            note = guidance.note;
            askedWith = asked;
        } catch (err) {
            // the raw answer is read here because askError below is only a flag
            console.error("ask_gloo:", err);
            askError = err instanceof Error ? err.message : String(err);
        } finally {
            asking = false;
        }
    }
</script>

{#snippet save(entry: Entry)}
    <button class="keep" onclick={() => keepIt(entry)} disabled={isKept(shelf, entry.usfm)}>
        {isKept(shelf, entry.usfm) ? "kept" : "keep this one"}
    </button>
{/snippet}

<div class="gutter">
    <p class="lede">{prompt}</p>

    <div class="pill-wrap">
        {#each FEELING_IDS as id}
            <button
<<<<<<< HEAD
                class="pill"
=======
                class="pill feeling"
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
                class:selected={selected.includes(id)}
                aria-pressed={selected.includes(id)}
                onclick={() => toggleFeeling(id)}
                disabled={asking}
            >{FEELINGS[id]}</button>
        {/each}
    </div>

    <button class="ask" onclick={ask} disabled={asking || selected.length === 0}>
        {selected.length ? "Ask" : "Pick a word first"}
    </button>
</div>

{#if note}
    <p class="note">{note}</p>
{/if}

{#if entries.length}
    <!-- the first result opens because it is the answer to the ask -->
    <div class="gutter results"><Passages {entries} action={save} openFirst /></div>
{:else if asking}
    <p class="placeholder">Looking</p>
{:else if askError}
    <p class="placeholder error">Couldn't reach the library, try again later.</p>
{:else}
    <p class="placeholder">Choose a word or two above, then ask.</p>
{/if}

<style>
    /* direct children of the companion's .body, a column flex container
       that component's own `.body > * { flex-shrink: 0 }` is Svelte-scoped and never
       reaches a child component's roots, so without this they shrink below their content */
    .gutter, .note, .placeholder { flex-shrink: 0; }

    .gutter { padding: 0 var(--pad); }
    .results { padding-bottom: 24px; }

    /* .pill and .pill-wrap are in companion.css */

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

    /* .keep is in companion.css */

    /* -- running copy -- */
    .lede {
        margin: 22px 0 14px;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.7);
        text-wrap: pretty;
    }
    .note {
        margin: 20px var(--pad) 0;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.68);
        text-wrap: pretty;
    }
    .placeholder {
        margin: auto var(--pad);
        padding: 40px 14px;
        font: italic 400 15px/1.7 var(--display);
        color: rgba(var(--ink), 0.45);
        text-align: center;
        text-wrap: pretty;
    }
    /* scoped so it outranks .placeholder, which Svelte also scopes */
    .error { color: rgba(var(--red), 0.65); }
</style>
