<script lang="ts">
    import { hitbox } from "$lib/stage/hitbox";

    let { onOpen }: { onOpen: () => void } = $props();
</script>

<button class="dots" use:hitbox onclick={onOpen} aria-label="see what He has for you">..!</button>

<style>
    /* matches Bubble's plate so opening it reads as the same object growing */
    .dots {
        position: relative;
        flex-shrink: 0;
        margin-bottom: 14px;
        padding: 5px 15px 8px;
        background: #fffdf5;
        border: 1px solid #d9d2bf;
        border-radius: 999px;
        cursor: pointer;
        font: 400 21px/1 var(--display);
        letter-spacing: 0.09em;
        color: var(--maroon);
        transition: background-color var(--tick) ease, border-color var(--tick) ease;
    }
    /* the pointer is only held here so hover is what proves it is a target */
    .dots:hover {
        background: #fff;
        border-color: var(--maroon);
    }

    /* the tail sits outside the measured rect so it is decoration and not a target */
    .dots::before,
    .dots::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        border: 6px solid transparent;
    }
    .dots::before {
        transform: translateX(-50%);
        border-top-color: #d9d2bf;
    }
    .dots::after {
        transform: translateX(-50%) translateY(-1.5px);
        border-top-color: #fffdf5;
    }

</style>
