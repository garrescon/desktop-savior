<script lang="ts">
    import {
        MIN_PRAYER, MAX_PRAYER, TRADITIONS, type Settings, type Tradition,
    } from "./settings";
    import { MIN_PACE, MAX_PACE, type Plan } from "$lib/reading/plan";
    import type { Book } from "$lib/youversion/api";

    let { settings, plan, books, onPrayerGoal, onPace, onBook, onTradition }: {
        settings: Settings;
        plan: Plan;
        books: Book[];
        onPrayerGoal: (delta: number) => void;
        onPace: (delta: number) => void;
        onBook: (usfm: string) => void;
        onTradition: (tradition: Tradition) => void;
    } = $props();

    // the named ones are Gloo's own words and only the absence needed one
    const TRADITION_LABELS: Record<Tradition, string> = {
        default: "No preference",
        evangelical: "Evangelical",
        catholic: "Catholic",
        mainline: "Mainline",
    };
</script>

<div class="settings">
    <div class="row">
        <div>
            <div class="row-label">which book</div>
            <div class="row-note">the one you're reading through right now</div>
        </div>

        <select
            class="picker"
            value={plan.book}
            disabled={!books.length}
            onchange={(e) => onBook(e.currentTarget.value)}
            aria-label="choose a book"
        >
            {#each books as book (book.usfm)}
                <option value={book.usfm}>{book.name}</option>
            {/each}
        </select>
    </div>

    <div class="row">
        <div>
            <div class="row-label">verses a day</div>
            <div class="row-note">how much of the book you're aiming for each day</div>
        </div>

        <div class="stepper">
            <button
                onclick={() => onPace(-1)}
                disabled={plan.pace <= MIN_PACE}
                aria-label="Fewer verses a day"
            >–</button>
            <span>{plan.pace} verses</span>
            <button
                onclick={() => onPace(1)}
                disabled={plan.pace >= MAX_PACE}
                aria-label="More verses a day"
            >+</button>
        </div>
    </div>

    <div class="row">
        <div>
            <div class="row-label">time with Him</div>
            <div class="row-note">how long you're aiming for each day</div>
        </div>

        <div class="stepper">
            <button
                onclick={() => onPrayerGoal(-1)}
                disabled={settings.prayerMinutes <= MIN_PRAYER}
                aria-label="less time"
            >–</button>
            <span>{settings.prayerMinutes} min</span>
            <button
                onclick={() => onPrayerGoal(1)}
                disabled={settings.prayerMinutes >= MAX_PRAYER}
                aria-label="more time"
            >+</button>
        </div>
    </div>

    <div class="row">
        <div>
            <div class="row-label">which tradition</div>
            <div class="row-note">the lens the answers come through</div>
        </div>

        <select
            class="picker"
            value={settings.tradition}
            onchange={(e) => onTradition(e.currentTarget.value as Tradition)}
            aria-label="choose a tradition"
        >
            {#each TRADITIONS as tradition}
                <option value={tradition}>{TRADITION_LABELS[tradition]}</option>
            {/each}
        </select>
    </div>

</div>

<style>
    .row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(var(--ink), 0.12);
    }
    .row + .row { padding-top: 16px; }

    .row-label {
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.6);
    }
    .row-note {
        margin-top: 7px;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.5);
        text-wrap: pretty;
    }

    .picker {
        flex: none;
        max-width: 46%;
        padding: 8px 9px;
        background: var(--surface);
        border: 1px solid var(--hair-firm);
        border-radius: 0;
        color: var(--walnut);
        font: 400 10.5px/1 var(--body);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
    .picker:disabled { color: rgba(var(--ink), 0.35); cursor: default; }

</style>
