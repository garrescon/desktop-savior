<script lang="ts">
    import { DEMO_MODE } from "$lib/dev";

    let { onRestore }: { onRestore: () => void } = $props();

    const HOLD_MS = 400;

    const PEEK_MIN_MS = DEMO_MODE ? 5_000 : 30_000;
    const PEEK_MAX_MS = DEMO_MODE ? 12_000 : 90_000;
    const PEEK_LASTS_MS = 600;

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let peeking = $state(false);

    function beginHold() {
        holdTimer = setTimeout(onRestore, HOLD_MS);
    }
    function cancelHold() {
        clearTimeout(holdTimer);
    }

    // randomized recurring lean-out
    $effect(() => {
        let waitId: ReturnType<typeof setTimeout>;
        let retreatId: ReturnType<typeof setTimeout>;

        function scheduleNext() {
            const quiet = PEEK_MIN_MS + Math.random() * (PEEK_MAX_MS - PEEK_MIN_MS);
            waitId = setTimeout(() => {
                peeking = true;
                retreatId = setTimeout(() => {
                    peeking = false;
                    scheduleNext();
                }, PEEK_LASTS_MS);
            }, quiet);
        }

        scheduleNext();
        return () => {
            clearTimeout(waitId);
            clearTimeout(retreatId);
        };
    });
</script>

<!-- deliberately not a drag region. hold-to-restore -->
<button
    class="stash"
    onpointerdown={beginHold}
    onpointerup={cancelHold}
    onpointerleave={cancelHold}
    aria-label="Bring Him back"
>
    <div class="icon" class:peeking></div>
</button>

<style>
    .stash {
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        cursor: pointer;
    }
    .icon {
        background: #444;
        border-radius: 8px;
        width: 100%;
        height: 100%;
        transition: transform 250ms ease;
    }
    .peeking {
        transform: translateY(-10px) rotate(-6deg);
    }
</style>