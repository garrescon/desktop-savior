<script lang="ts">
    import { PLAN_BOOK_NAME, finishedBy, type Plan, type Reading } from "./plan";

    let { plan, reading, total, loaded, error, versesToday, onVerses, onOpen }: {
        plan: Plan;
        reading: Reading | null;
        total: number;
        loaded: boolean;      // the book's chapter lengths have arrived
        error: boolean;
        versesToday: number;  // the day log's count, not the bookmark
        onVerses: (next: number) => void;
        onOpen: () => void;
    } = $props();

    const percent = $derived(total ? Math.min(100, (plan.versesRead / total) * 100) : 0);
    const finish = $derived(
        finishedBy(total - plan.versesRead, plan.pace)
            .toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
    const atEnd = $derived(total > 0 && plan.versesRead >= total);

    // stored count is the only copy and updates when input is received
    function commit(event: Event & { currentTarget: HTMLInputElement }) {
        const parsed = parseInt(event.currentTarget.value, 10);
        if (Number.isFinite(parsed)) onVerses(parsed);
        // reverts when rejecting bad input
        event.currentTarget.value = String(versesToday);
    }
</script>

<!-- shown in both branches -->
{#snippet entry()}
    <div class="plan-entry">
        <div class="stepper live">
            <button
                onclick={() => onVerses(versesToday - 1)}
                disabled={versesToday <= 0}
                aria-label="[one verse fewer]"
            >–</button>
            <input
                inputmode="numeric"
                value={versesToday}
                onchange={commit}
                onblur={commit}
                aria-label="[verses read today]"
            />
            <button
                onclick={() => onVerses(versesToday + 1)}
                disabled={atEnd}
                aria-label="[one verse more]"
            >+</button>
        </div>
        <div class="plan-label">Verses Read</div>
    </div>
{/snippet}

{#if reading}
    <div class="plan">
        <div class="plan-today">
            <div class="plan-ref">{PLAN_BOOK_NAME} {reading.label}</div>
            {@render entry()}
        </div>

        <div class="plan-meter">
            <div class="meter"><div class="meter-fill" style="width: {percent}%"></div></div>
            <div class="plan-count">
                <span>{plan.versesRead} of {total} verses · finished by {finish}</span>
                <button class="plan-link" onclick={onOpen}>
                    <span class="plan-link-text">Bible.com</span>
                    <svg class="ext" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M8 6.9v3.9H1.2V4h3.9" />
                        <path d="M6.7 1.2h4.1v4.1" />
                        <path d="M10.8 1.2 5.5 6.5" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
{:else if error}
    <p class="plan-status">Couldn't load the reading plan, try again later.</p>
{:else if loaded}
    <div class="plan">
        <div class="plan-today">
            <p class="plan-finished">{PLAN_BOOK_NAME} is finished!</p>
            {@render entry()}
        </div>
    </div>
{:else}
    <p class="plan-status">Opening {PLAN_BOOK_NAME}…</p>
{/if}

<style>
    /* the gap above comes from .section's head rule */

    /* centred, not baseline-aligned
       The display face has descenders that hang below the
       stepper's bottom edge when the two are bottom-aligned */
    .plan-today {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
    }

    .plan-ref {
        font: 400 28px/1 var(--display);
        font-variant-numeric: tabular-nums;
        color: var(--walnut);
    }

    /* The caption is taken out of the flow so this block is exactly as tall as
       the stepper and the same height as the prayer button. That is what lets one
       --head-gap produce the same visible gap in both sections. while the
       caption was in the flow, this block was 65px against the button's 32px
       and the two could only be matched by hand. --row-gap below leaves the
       room the caption now floats into. */
    .plan-entry {
        flex: none;
        position: relative;
    }
    .plan-label {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 7px;
        font: 400 9.5px/1 var(--body);
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(var(--ink), 0.45);
        text-align: center;
    }

    /* a live control, so it borrows the prayer button's colour — and its width,
       via --ticker, so the two sections' controls are built to one size */
    .stepper.live {
        width: var(--ticker);
        box-sizing: border-box;   /* a button is border-box; match it or --ticker means two sizes */
        border-color: var(--maroon);
    }
    .stepper.live input { flex: 1; width: auto; min-width: 0; }
    .stepper.live button:first-child { border-right-color: rgba(var(--red), 0.3); }
    .stepper.live button:last-child { border-left-color: rgba(var(--red), 0.3); }

    .plan-meter { margin-top: var(--row-gap); }
    .plan-count {
        margin-top: 7px;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        font: 400 10px/1.3 var(--body);
        color: rgba(var(--ink), 0.5);
        font-variant-numeric: tabular-nums;
    }

    /* Bible.com link that shares verse count line */
    .plan-link {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        font: italic 400 10px/1.3 var(--body);
        color: var(--maroon);
        white-space: nowrap;
    }

    .plan-link-text { text-decoration: underline; }

    /* drawn box-with-arrow url symbol */
    .ext {
        width: 1em;
        height: 1em;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.3;
        stroke-linecap: round;
        stroke-linejoin: round;
    }

    .plan-status, .plan-finished {
        margin: 0;
        font: italic 400 12px/1.5 var(--body);
        color: rgba(var(--ink), 0.5);
    }
    .plan-status { margin-top: 9px; }
    .plan-finished { flex: 1; min-width: 0; }
</style>
