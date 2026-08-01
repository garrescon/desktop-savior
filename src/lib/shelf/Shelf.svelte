<script lang="ts">
    import Passages, { type Entry } from "./Passages.svelte";
    import { noteFor, originFor, type Origin, type Shelf } from "./shelf";
    import { FEELINGS, type FeelingId } from "$lib/feelings/feelings";
    import { REMINDERS, type ReminderTheme } from "$lib/reminder/themes";
    import { aspectLabel } from "$lib/discover/aspects";

    let { shelf, onDrop, onAnnotate }: {
        shelf: Shelf;
        onDrop: (usfm: string) => void;
        onAnnotate: (usfm: string, note: string) => void;
    } = $props();

    // an id with no current label is dropped rather than shown raw
<<<<<<< HEAD
    // every kind is named rather than falling through
    // a kind that lands in the wrong lookup finds nothing and drops the chip silently
    function labelFor(origin: Origin, id: string): string | null {
        if (origin.kind === "feeling") return FEELINGS[id as FeelingId] ?? null;
        if (origin.kind === "aspect") return aspectLabel(id);
        if (origin.kind === "theme") return REMINDERS[id as ReminderTheme]?.label ?? null;
        return null;
=======
    function labelFor(origin: Origin, id: string): string | null {
        if (origin.kind === "feeling") return FEELINGS[id as FeelingId] ?? null;
        if (origin.kind === "aspect") return aspectLabel(id);
        return REMINDERS[id as ReminderTheme]?.label ?? null;
>>>>>>> b90a09e8e3c1287187510faf39de38285d904764
    }

    function wordsFor(usfm: string): string[] {
        const origin = originFor(shelf, usfm);
        if (!origin) return [];
        return origin.ids
            .map((id) => labelFor(origin, id))
            .filter((word): word is string => word !== null);
    }

    // the draft is not persisted, so an abandoned sentence does not come back
    let editing = $state<string | null>(null);
    let draft = $state("");

    function startEdit(usfm: string) {
        draft = noteFor(shelf, usfm);
        editing = usfm;
    }

    function commit() {
        if (editing === null) return;
        onAnnotate(editing, draft);
        editing = null;
        draft = "";
    }

    function cancel() {
        editing = null;
        draft = "";
    }

    function keys(event: KeyboardEvent) {
        if (event.key === "Escape") {
            event.preventDefault();
            cancel();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            commit();
        }
    }

    function takeFocus(node: HTMLTextAreaElement) {
        node.focus();
        // caret to the end, so editing an existing note continues it
        node.setSelectionRange(node.value.length, node.value.length);
    }
</script>

{#snippet release(entry: Entry)}
    <button class="release" onclick={() => onDrop(entry.usfm)}>Remove</button>
{/snippet}

{#snippet annotation(entry: Entry)}
    {@const written = noteFor(shelf, entry.usfm)}
    {@const words = wordsFor(entry.usfm)}

    <!-- the words are the whole label, so there is no copy to write here -->
    {#if words.length}
        <ul class="from">
            {#each words as word}<li class="chip">{word}</li>{/each}
        </ul>
    {/if}

    {#if editing === entry.usfm}
        <div class="editor">
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
                <button class="quiet" onclick={cancel}>cancel</button>
                <button class="quiet firm" onclick={commit}>save</button>
            </div>
        </div>
    {:else if written}
        <p class="written">{written}</p>
        <button class="quiet" onclick={() => startEdit(entry.usfm)}>edit</button>
    {:else}
        <button class="quiet" onclick={() => startEdit(entry.usfm)}>add a note</button>
    {/if}
{/snippet}

<div class="kept">
    {#if shelf.length}
        <Passages entries={shelf} action={release} {annotation} />
    {:else}
        <p class="empty">nothing kept yet</p>
    {/if}
</div>

<style>
    .kept { margin-top: 4px; }

    .release {
        padding: 8px 12px;
        background: transparent;
        color: rgba(var(--ink), 0.5);
        border: 1px solid var(--hair-firm);
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color var(--tick) ease, border-color var(--tick) ease;
    }
    .release:hover { color: var(--maroon); border-color: var(--maroon); }

    .empty {
        margin: 12px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.45);
    }

    /* --- where it came from --- */

    .from {
        margin: 0 0 12px;
        padding: 0;
        list-style: none;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
    }
    .chip {
        padding: 4px 8px 5px;
        border: 1px solid rgba(var(--gold), 0.55);
        border-radius: 999px;
        font: 400 9px/1 var(--body);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.55);
    }

    /* --- the note --- */

    /* roman against a rule, so it is not mistaken for the italic note gloo writes */
    .written {
        margin: 0;
        padding-left: 12px;
        border-left: 1px solid rgba(var(--gold), 0.55);
        font: 400 13.5px/1.65 var(--body);
        color: rgba(var(--ink), 0.78);
        white-space: pre-wrap;
        text-wrap: pretty;
    }

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
    .draft:focus-visible { outline: 1px solid var(--maroon); outline-offset: 1px; }
    .draft::placeholder { color: rgba(var(--ink), 0.35); font-style: italic; }

    .editor-act {
        margin-top: 8px;
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }

    /* quieter than Remove, since writing a note is not something to urge */
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

    .written + .quiet { margin-top: 6px; margin-left: 12px; }
</style>
