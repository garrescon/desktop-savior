<script lang="ts" generics="T extends string">
    let { tabs, current, onSelect }: {
        tabs: { id: T; label: string }[];
        current: T;
        onSelect: (id: T) => void;
    } = $props();
</script>

<div class="marks" role="tablist">
    {#each tabs as tab}
        <button
            class="mark"
            class:on={tab.id === current}
            role="tab"
            aria-selected={tab.id === current}
            onclick={() => onSelect(tab.id)}
        >{tab.label}</button>
    {/each}
</div>

<style>
    .marks {
        display: flex;
        gap: 3px;
        padding: 0 12px;
        margin-top: 18px;
    }

    .mark {
        flex: 1;
        padding: 9px 6px 10px;
        border: none;
        cursor: pointer;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: rgba(241, 231, 210, 0.6);
        background: rgba(0, 0, 0, 0.14);
        transition: background-color var(--tick) ease, color var(--tick) ease;
    }
    .mark:hover { color: var(--cream); }

    /* the active mark is the page pulled down over the band's edge */
    .mark.on {
        background: var(--paper);
        color: var(--walnut);
        margin-bottom: -1px;
        padding-bottom: 11px;
    }

    /* inset because an outward outline is clipped by the flush edge */
    .mark:focus-visible {
        outline: 1px solid var(--mustard);
        outline-offset: -3px;
    }
</style>
