<script lang="ts">
    import { MediaQuery } from "svelte/reactivity";
    import { REMINDERS, type ReminderTheme } from "./themes";

    let { onRemind, onFeelings }: {
        onRemind: (theme: ReminderTheme) => void;
        onFeelings: () => void;
    } = $props();

    const themes = Object.entries(REMINDERS) as [ReminderTheme, typeof REMINDERS[ReminderTheme]][];

    const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");

    let wordIndex = $state(0);
    let wordFading = $state(false);
    let menuOpen = $state(false);

    const CYCLE_MS = 2600, FADE_MS = 240;
    const cycleWord = $derived(themes[wordIndex % themes.length][1].label);

    // leaving the tab unmounts this and stops the cycle
    $effect(() => {
        if (menuOpen || reduceMotion.current || themes.length < 2) return;

        let swap: ReturnType<typeof setTimeout>;
        const tick = setInterval(() => {
            wordFading = true;
            swap = setTimeout(() => {
                wordIndex += 1;
                wordFading = false;
            }, FADE_MS);
        }, CYCLE_MS);

        return () => {
            clearInterval(tick);
            clearTimeout(swap);
            wordFading = false;   // prevents word-stranding mid-fade
        };
    });

    function pick(theme: ReminderTheme) {
        onRemind(theme);
        menuOpen = false;
    }
</script>

<div class="plate">
    <div class="plate-frame">
        <p class="invocation">
            <span>Remind me of His ...</span>
            <span class="word-slot"
                ><button
                    class="word"
                    class:fading={wordFading}
                    onclick={() => (menuOpen = !menuOpen)}
                    aria-expanded={menuOpen}
                >{cycleWord}</button><span class="caret" aria-hidden="true">▾</span></span>
        </p>

        {#if menuOpen}
            <div class="word-menu">
                <div class="sublabel menu-label">Every theme</div>
                <div class="word-grid">
                    {#each themes as [theme, def]}
                        <button class="word-option" onclick={() => pick(theme)}>
                            <span>{def.label}</span>
                            <span class="word-count">{def.refs.length}</span>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <button class="feel-link" onclick={onFeelings}>
            Or name how you feel >
        </button>
    </div>
</div>

<style>
    /* the gap above comes from .section's head rule */

    /* "Remind me of His ..." */
    .invocation {
        margin: 0;
        font: 400 27px/1.25 var(--display);
        color: var(--walnut);
    }
    .word-slot { position: relative; display: inline-block; }
    /* word button */
    .word {
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font: italic 400 27px/1.25 var(--display);
        color: var(--maroon);
        border-bottom: 1px dashed rgba(var(--red), 0.5);
        opacity: 1;
        transition: opacity 220ms ease;
    }
    .word:hover { border-bottom-style: solid; }

    .word.fading { opacity: 0.18; }
    .caret {
        margin-left: 5px;
        font: 400 12px/1 var(--body);
        color: rgba(var(--red), 0.55);
    }

    .word-menu {
        margin-top: 14px;
        border-top: 1px solid rgba(var(--gold), 0.45);
        padding-top: 12px;
    }
    .menu-label { display: block; margin-bottom: 10px; }
    .word-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 14px; }
    .word-option {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        text-align: left;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(var(--ink), 0.1);
        padding: 6px 0;
        cursor: pointer;
        font: 400 17px/1.15 var(--display);
        color: var(--walnut);
        transition: color var(--tick) ease;
    }
    .word-option:hover { color: var(--maroon); }
    .word-count {
        font: 400 9.5px/1 var(--body);
        color: rgba(var(--ink), 0.35);
        font-variant-numeric: tabular-nums;
    }

    /* the second way out of the plate */
    .feel-link {
        display: block;
        margin-top: 15px;
        padding: 0 0 2px;
        text-align: left;
        background: transparent;
        border: none;
        border-bottom: 1px dotted rgba(var(--ink), 0.32);
        cursor: pointer;
        font: italic 400 13px/1.5 var(--body);
        color: rgba(var(--ink), 0.62);
        transition: color var(--tick) ease, border-color var(--tick) ease;
    }
    .feel-link:hover { color: var(--maroon); border-color: var(--maroon); }

</style>
