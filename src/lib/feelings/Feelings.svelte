<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { getCachedPassage } from "$lib/youversion/cache";
    import Passages, { type Entry } from "$lib/shelf/Passages.svelte";
    import { loadShelf, saveShelf, keep, isKept } from "$lib/shelf/shelf";
    import { FEELINGS, FEELING_IDS, type FeelingId } from "./feelings";
    import { loadSettings } from "$lib/day/progress";

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

    // re-reads first — the book tab writes this same shelf
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
            // the tradition is re-read because settings live in the other tab
            const guidance = await invoke<Guidance>("ask_gloo", {
                feelings: asked.map((id) => FEELINGS[id]),
                tradition: loadSettings().tradition,
            });

            // is_usfm checks a reference's shape, not that it exists, so a
            // well-formed invention reaches YouVersion and 404s there. One of
            // those shouldn't cost the references that did come back.
            const refs = guidance.references;
            const results = await Promise.allSettled(refs.map(getCachedPassage));

            // allSettled preserves order, so the index still names the reference
            const found: Entry[] = [];
            results.forEach((r, i) => {
                if (r.status === "fulfilled") found.push({ ...r.value, usfm: refs[i] });
            });

            const missing = results.length - found.length;
            if (missing) console.warn(`feelings: ${missing}/${results.length} references unavailable`);

            // the note is written to sit beside scripture; with nothing beside
            // it, it is the app speaking on its own
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
                class="pill feeling"
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
    <p class="placeholder">Finding verses…</p>
{:else if askError}
    <p class="placeholder error">Couldn't reach the library, try again later.</p>
{:else}
    <p class="placeholder">Choose a word or two above, then ask.</p>
{/if}

<style>
    /* Direct children of the companion's .body, a column flex container. That
       component's own `.body > * { flex-shrink: 0 }` is Svelte-scoped and never
       reaches a child component's roots, so without this they shrink below
       their content. */
    .gutter, .note, .placeholder { flex-shrink: 0; }

    .gutter { padding: 0 var(--pad); }
    .results { padding-bottom: 24px; }

    /* feeling button */
    .pill {
        flex: none;
        font: 400 16px/1 var(--display);
        color: var(--walnut);
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.55);
        border-radius: 999px;
        padding: 8px 14px 9px;
        cursor: pointer;
        white-space: nowrap;
        transition: color var(--tick) ease, border-color var(--tick) ease, background-color var(--tick) ease;
    }
    .pill:hover:not(:disabled) {
        color: var(--maroon);
        border-color: var(--maroon);
        background: #fffdf6;
    }

    .pill-wrap { display: flex; flex-wrap: wrap; gap: 7px; }
    .feeling {
        padding: 10px 15px 11px;
        border-color: rgba(var(--ink), 0.22);
    }
    /* mustard button fill */
    .feeling.selected,
    .feeling.selected:hover {
        background: var(--mustard);
        border-color: var(--mustard);
        color: var(--surface);
    }
    .feeling:disabled { opacity: 0.5; cursor: default; }

    /* the full-width action */
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

    /* reads as done rather than offering the same passage twice */
    .keep {
        padding: 8px 12px;
        background: transparent;
        color: var(--maroon);
        border: 1px solid var(--maroon);
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .keep:hover:not(:disabled) { background: rgba(var(--red), 0.07); }
    .keep:disabled {
        color: rgba(var(--ink), 0.38);
        border-color: var(--hair-firm);
        cursor: default;
    }

    /* -- running copy -- */
    .lede {
        margin: 22px 0 14px;
        font: italic 400 13.5px/1.6 var(--body);
        color: rgba(var(--ink), 0.7);
        text-wrap: pretty;
    }
    /* gloo's note */
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
    .error { color: rgba(var(--red), 0.65); }
</style>
