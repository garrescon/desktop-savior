<script lang="ts">
    import { plansIn, versesRead, type Plan } from "./plan";
    import type { Book } from "$lib/youversion/api";

    let { plan, books, onSelect }: {
        plan: Plan;
        books: Book[];
        onSelect: (usfm: string) => void;
    } = $props();

    let open = $state(false);

    // canonical order once the book list has arrived
    const order = $derived(books.map((b) => b.usfm));
    const mine = $derived(plansIn(plan, order));

    // falls back to the USFM, the same as the section heading does
    function nameOf(usfm: string): string {
        return books.find((b) => b.usfm === usfm)?.name ?? usfm;
    }

    // one book is just the book you are reading, and a list of one is only clutter
    const worth = $derived(mine.length > 1);

    function choose(usfm: string) {
        if (usfm !== plan.book) onSelect(usfm);
        open = false;
    }
</script>

{#if worth}
    <div class="plans">
        <button class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
            <span class="caret" aria-hidden="true">{open ? "›" : "‹"}</span>
            Your Plans
        </button>

        {#if open}
            <ul class="list">
                {#each mine as usfm (usfm)}
                    {@const here = usfm === plan.book}
                    {@const read = versesRead(plan, usfm)}
                    <li>
                        <button class="entry" class:here onclick={() => choose(usfm)} disabled={here}>
                            <span class="name">{nameOf(usfm)}</span>
                            <!-- what you have read, never what is left, and never a share of a whole.
                                 a book you have not started shows nothing rather than a zero, which
                                 would read as a score. -->
                            {#if read > 0}
                                <span class="read">{read}</span>
                            {/if}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/if}

<style>
    .plans { margin-top: 16px; padding-top: 13px; border-top: 1px solid var(--hair); }

    .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0;
        background: transparent;
        border: none;
        color: rgba(var(--ink), 0.5);
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color var(--tick) ease;
    }
    .toggle:hover { color: var(--maroon); }
    .caret { display: inline-block; font: 400 12px/1 var(--body); }

    .list { margin: 10px 0 0; padding: 0; list-style: none; }

    .entry {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 9px 0;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: color var(--tick) ease;
    }
    .entry:hover:not(:disabled) { color: var(--maroon); }
    /* the one you are on reads as a statement rather than an offer */
    .entry.here { color: var(--maroon); cursor: default; }

    .name { font: 400 13.5px/1.3 var(--body); }
    .read {
        flex: none;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.14em;
        color: rgba(var(--ink), 0.42);
        font-variant-numeric: tabular-nums;
    }
    .entry.here .read { color: rgba(var(--red), 0.55); }
</style>
