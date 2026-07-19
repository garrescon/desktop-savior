<script lang="ts">
    let { onRestore }: { onRestore: () => void } = $props();

    const HOLD_MS = 400;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    function beginHold() {
        holdTimer = setTimeout(onRestore, HOLD_MS);
    }
    function cancelHold() {
        clearTimeout(holdTimer);
    }
</script>

<button
    class="stash"
    onpointerdown={beginHold}
    onpointerup={cancelHold}
    onpointerleave={cancelHold}
    aria-label="Bring Him back"
    style="width: 100%; height: 100%; background: transparent; border: none; cursor: pointer;"
>
    <div style="background: #444; border-radius: 8px; width: 100%; height: 100%;"></div>
</button>