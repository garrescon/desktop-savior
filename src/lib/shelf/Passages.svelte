<script lang="ts">
    import type { Snippet } from "svelte";
    import type { Keepable } from "./shelf";

    export type Entry = Keepable;

    let { entries, action, annotation, openFirst = false }: {
        entries: Entry[];
        action?: Snippet<[Entry]>;
        // the caller owns everything inside, so this component holds no copy
        annotation?: Snippet<[Entry]>;
        openFirst?: boolean;
    } = $props();

    let opened = $state<string | null>(null);

    const open = $derived(
        entries.some((e) => e.usfm === opened)
            ? opened
            : openFirst
              ? entries[0]?.usfm ?? null
              : null,
    );
</script>

<div class="stack">
    {#each entries as entry (entry.usfm)}
        {#if entry.usfm === open}
            <blockquote class="verse-plate">
                <span class="verse-mark" aria-hidden="true">“</span>
                <div class="verse-frame">
                    <p class="verse-text">{entry.text}</p>
                    <!-- the citation doubles as the collapse control -->
                    <!-- aria-expanded carries the state so neither button needs a label -->
                    <button class="verse-ref" aria-expanded="true" onclick={() => (opened = null)}>
                        <span class="verse-rule" aria-hidden="true"></span>
                        <cite>{entry.reference}</cite>
                    </button>
                    {#if annotation}
                        <div class="verse-note">{@render annotation(entry)}</div>
                    {/if}
                    {#if action}
                        <div class="verse-act">{@render action(entry)}</div>
                    {/if}
                </div>
            </blockquote>
        {:else}
            <button class="row" aria-expanded="false" onclick={() => (opened = entry.usfm)}>
                <span class="row-caret" aria-hidden="true">›</span>
                <span class="row-ref">{entry.reference}</span>
            </button>
        {/if}
    {/each}

    <!-- one notice for the list because the license asks per page and not per verse -->
    <!-- every entry carries the same version so the first one speaks for all of them -->
    {#if entries.length}
        <p class="credit">{entries[0].versionTitle} · {entries[0].copyright}</p>
    {/if}
</div>

<style>
    .stack { flex-shrink: 0; }

    .verse-plate {
        margin: 16px 0 0;
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
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--maroon);
        font-variant-numeric: tabular-nums;
        transition: opacity var(--tick) ease;
    }
    .verse-ref:hover { opacity: 0.65; }
    .verse-ref:focus-visible { outline: 1px solid var(--mustard); outline-offset: 3px; }
    /* <cite> is italic by default, the reference is set in caps */
    .verse-ref cite { font-style: normal; }
    .verse-rule { width: 18px; height: 1px; background: var(--maroon); }
    .credit {
        margin: 16px 0 0;
        font: 400 9.5px/1.5 var(--body);
        color: rgba(var(--ink), 0.42);
        text-wrap: pretty;
    }
    /* only the distance from the credit line, the rest is the caller's */
    .verse-note { margin-top: 16px; }

    .verse-act {
        margin-top: 16px;
        padding-top: 13px;
        border-top: 1px solid var(--hair);
        display: flex;
        justify-content: flex-end;
    }

    /* --- the closed rows --- */
    .row {
        display: grid;
        grid-template-columns: 10px 1fr;
        gap: 10px;
        align-items: baseline;
        width: 100%;
        text-align: left;
        padding: 12px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
        cursor: pointer;
        color: inherit;
        transition: color var(--tick) ease;
    }
    .row:hover { color: var(--maroon); }
    .row-caret { font: 400 12px/1 var(--body); color: rgba(var(--ink), 0.4); }
    .row-ref {
        font: 400 11px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-variant-numeric: tabular-nums;
    }
</style>
