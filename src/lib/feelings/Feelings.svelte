<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import { getPassage, type Passage } from "$lib/youversion/api";

    // keep in sync with Guidance struct in src-tauri/src/gloo.rs
    interface Guidance { references: string[]; note: string; }

    const FEELINGS = [
        "Peaceful", "Accomplished", "Loved",
        "Unforgiving", "Lonely", "Unmotivated",
    ];

    // this component is unmounted on exit so it clears
    let selected = $state<string[]>([]);
    let note = $state<string | null>(null);
    let passages = $state<Passage[]>([]);
    let shownIndex = $state(0);
    let asking = $state(false);
    let askError = $state<string | null>(null);

    const shown = $derived(passages[shownIndex] ?? null);
    const shelf = $derived(
        passages.map((p, i) => ({ p, i })).filter(({ i }) => i !== shownIndex),
    );

    const prompt = $derived(
        selected.length
            ? "Pick as many as you'd like."
            : "How do you feel?",
    );

    function toggleFeeling(feeling: string) {
        selected = selected.includes(feeling)
            ? selected.filter((f) => f !== feeling)
            : [...selected, feeling];
    }

    // one line per row
    // end on the first punctuation available if it's too long
    function snippet(text: string): string {
        const cut = text.search(/[,;:.]/);
        const head = cut > 24 ? text.slice(0, cut) : text;
        return head.length > 44 ? `${head.slice(0, 44).trimEnd()}…` : head;
    }

    async function ask() {
        asking = true;
        askError = null;
        note = null;
        passages = [];
        shownIndex = 0;
        try {
            const guidance = await invoke<Guidance>("ask_gloo", { feelings: selected });

            // ignore non-existant USFM
            const results = await Promise.allSettled(guidance.references.map(getPassage));
            const found = results
                .filter((r): r is PromiseFulfilledResult<Passage> => r.status === "fulfilled")
                .map((r) => r.value);

            const missing = results.length - found.length;
            if (missing) console.warn(`feelings: ${missing}/${results.length} references unavailable`);

            if (!found.length) throw new Error("no references resolved");

            passages = found;
            note = guidance.note;
        } catch (err) {
            askError = err instanceof Error ? err.message : String(err);
        } finally {
            asking = false;
        }
    }
</script>

<div class="gutter">
    <p class="lede">{prompt}</p>

    <div class="pill-wrap">
        {#each FEELINGS as feeling}
            <button
                class="pill feeling"
                class:selected={selected.includes(feeling)}
                aria-pressed={selected.includes(feeling)}
                onclick={() => toggleFeeling(feeling)}
                disabled={asking}
            >{feeling}</button>
        {/each}
    </div>

    <button class="ask" onclick={ask} disabled={asking || selected.length === 0}>
        {selected.length ? "Ask" : "Pick a word first"}
    </button>
</div>

{#if note}
    <p class="note">{note}</p>
{/if}

{#if shown}
    <blockquote class="verse-plate">
        <span class="verse-mark" aria-hidden="true">“</span>
        <div class="verse-frame">
            <p class="verse-text">{shown.text}</p>
            <div class="verse-ref">
                <span class="verse-rule" aria-hidden="true"></span>
                <cite>{shown.reference}</cite>
            </div>
            <p class="verse-credit">{shown.versionTitle} · {shown.copyright}</p>
        </div>
    </blockquote>

    {#if shelf.length}
        <div class="gutter shelf">
            <div class="rule-head">
                <span class="eyebrow">Also on the shelf tonight</span>
                <span class="rule" aria-hidden="true"></span>
            </div>
            {#each shelf as { p, i }}
                <button class="shelf-row" onclick={() => (shownIndex = i)}>
                    <span class="shelf-snippet">{snippet(p.text)}</span>
                    <span class="shelf-ref">{p.reference}</span>
                </button>
            {/each}
        </div>
    {/if}

{:else if asking}
    <p class="placeholder">Finding verses…</p>
{:else if askError}
    <p class="placeholder error">Couldn't reach the library, try again later.</p>
{:else}
    <p class="placeholder">Choose a word or two above, then ask.</p>
{/if}

<style>
    .gutter { padding: 0 var(--pad); }

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

    /* the verse */
    .verse-plate {
        margin: 20px var(--pad) 0;
        padding: 14px;
        background: var(--surface);
        border: 1px solid rgba(var(--gold), 0.45);
        position: relative;
        overflow: hidden;
    }
    /* big quote mark, clipped by the overflow on .verse-plate */
    .verse-mark {
        position: absolute;
        top: 2px;
        left: 6px;
        font: 400 108px/0.86 var(--display);
        color: var(--mustard);
        opacity: 0.12;
        pointer-events: none;
    }
    .verse-frame {
        position: relative;
        border: 1px solid rgba(var(--gold), 0.3);
        padding: 26px 22px 20px;
    }
    .verse-text {
        margin: 0;
        font: 400 23px/1.55 var(--display);
        text-wrap: pretty;
    }
    .verse-ref {
        margin-top: 18px;
        display: flex;
        align-items: center;
        gap: 10px;
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--maroon);
        font-variant-numeric: tabular-nums;
    }
    /* <cite> is italic by default, the reference is set in caps */
    .verse-ref cite { font-style: normal; }
    .verse-rule { width: 18px; height: 1px; background: var(--maroon); }
    .verse-credit {
        margin: 8px 0 0;
        font: 400 9.5px/1.5 var(--body);
        color: rgba(var(--ink), 0.42);
    }

    /* the shelf */
    .shelf { padding-top: 24px; padding-bottom: 24px; }

    .shelf-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: baseline;
        width: 100%;
        text-align: left;
        padding: 11px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
        cursor: pointer;
        font: inherit;
        color: inherit;
        transition: background-color var(--tick) ease;
    }
    .shelf-row:hover { background: rgba(var(--gold), 0.06); }
    .shelf-snippet {
        font: 400 18px/1.3 var(--display);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .shelf-ref {
        font: 400 10px/1 var(--body);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.45);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

</style>
