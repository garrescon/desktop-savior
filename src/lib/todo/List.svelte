<script lang="ts">
    import { MAX_TEXT, type Pool } from "./pool";

    let { pool, today, onAdd, onToggle, onRemove }: {
        pool: Pool;
        today: string;
        onAdd: (text: string) => void;
        onToggle: (id: string) => void;
        onRemove: (id: string) => void;
    } = $props();

    let draft = $state("");

    const waiting = $derived(pool.filter((item) => item.completedOn === null));
    const done = $derived(pool.filter((item) => item.completedOn === today));

    function submit(event: SubmitEvent) {
        event.preventDefault();
        const text = draft.trim();
        if (!text) return;
        onAdd(text);
        draft = "";
    }
</script>

<div class="pool">
    <form class="compose" onsubmit={submit}>
        <input
            bind:value={draft}
            maxlength={MAX_TEXT}
            placeholder="Where can you put the Word in practice?"
            aria-label="new item"
        />
        <button type="submit" disabled={!draft.trim()}>keep</button>
    </form>

    {#if waiting.length}
        <ul class="items">
            {#each waiting as item (item.id)}
                <li>
                    <button class="drop" onclick={() => onRemove(item.id)} aria-label="remove">×</button>
                    <span class="text">{item.text}</span>
                    <button class="check" onclick={() => onToggle(item.id)} aria-label="mark done"></button>
                </li>
            {/each}
        </ul>
    {:else}
        <p class="empty">nothing waiting</p>
    {/if}

    {#if done.length}
        <div class="rule-head">
            <span class="sublabel">done today</span>
            <span class="rule" aria-hidden="true"></span>
        </div>
        <ul class="items">
            {#each done as item (item.id)}
                <li class="done-row">
                    <span class="text spent">{item.text}</span>
                    <button class="check done" onclick={() => onToggle(item.id)} aria-label="undo">✓</button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    /* the gap above comes from .section's head rule */

    .compose {
        display: flex;
        gap: 9px;
        align-items: stretch;
    }
    .compose input {
        flex: 1;
        min-width: 0;
        padding: 9px 10px;
        background: var(--surface);
        border: 1px solid var(--hair-firm);
        color: var(--walnut);
        font: 400 15px/1.2 var(--display);
    }
    .compose input::placeholder {
        color: rgba(var(--ink), 0.38);
        font-style: italic;
    }
    .compose input:focus { outline: none; border-color: var(--mustard); }

    .compose button {
        flex: none;
        padding: 0 14px;
        background: transparent;
        color: var(--maroon);
        border: 1px solid var(--maroon);
        font: 400 10px/1 var(--body);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color var(--tick) ease;
    }
    .compose button:hover:not(:disabled) { background: rgba(var(--red), 0.07); }
    .compose button:disabled {
        color: rgba(var(--ink), 0.35);
        border-color: rgba(var(--ink), 0.2);
        cursor: default;
    }

    .items { list-style: none; margin: 14px 0 0; padding: 0; }
    /* sits last so it lines up with the seal's boxes */
    .items li {
        display: grid;
        grid-template-columns: auto 1fr 20px;
        align-items: center;
        gap: 11px;
        padding: 9px 0;
        border-bottom: 1px solid rgba(var(--ink), 0.1);
    }
    .items li.done-row { grid-template-columns: 1fr 20px; }

    /* seal's square but smaller */
    .check {
        width: 20px;
        height: 20px;
        padding: 0;
        background: var(--surface);
        border: 1px solid rgba(var(--ink), 0.3);
        color: var(--cream);
        font: 400 12px/1 var(--body);
        cursor: pointer;
        transition: background-color var(--tick) ease, border-color var(--tick) ease;
    }
    .check:hover { border-color: var(--mustard); }
    .check.done {
        background: var(--walnut);
        border-color: var(--walnut);
    }

    .text {
        font: 400 17px/1.35 var(--display);
        color: var(--walnut);
        text-wrap: pretty;
    }
    .spent { color: rgba(var(--ink), 0.45); }

    .drop {
        background: transparent;
        border: none;
        padding: 0 2px;
        cursor: pointer;
        font: 400 16px/1 var(--body);
        color: rgba(var(--ink), 0.3);
        transition: color var(--tick) ease;
    }
    .drop:hover { color: var(--maroon); }

    .empty {
        margin: 16px 0 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.45);
    }

    .rule-head { margin-top: 20px; }
</style>
