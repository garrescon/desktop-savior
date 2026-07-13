<script lang="ts">
    import type { AsepriteSheet } from './types';

    interface Props {
        src: string;
        sheet: AsepriteSheet;
        tag: string;
    }

    let { src, sheet, tag }: Props = $props();

    let frameIndex = $state(0);

    const activeTag = $derived(sheet.meta.frameTags.find((t) => t.name === tag));
    const frame = $derived(sheet.frames[frameIndex].frame);

    $effect(() => {
        if (!activeTag) {
            console.error(`"${tag}" isn't in spritesheet tags`);
            return;
        }

        const { from, to } = activeTag;
        frameIndex = from;

        let elapsed = 0;
        let last = performance.now();
        let rafId = requestAnimationFrame(function tick(now) {
            elapsed += now - last;
            last = now;
            if (elapsed >= sheet.frames[frameIndex].duration) {
                elapsed -= sheet.frames[frameIndex].duration;
                // Loop back to the start of the tag if we reach the end
                frameIndex = frameIndex >= to ? from : frameIndex + 1;
            }
            rafId = requestAnimationFrame(tick);
        });
        
        return () => cancelAnimationFrame(rafId);
    });
</script>

<div
    data-tauri-drag-region
    style:width="{frame.w}px"
    style:height="{frame.h}px"
    style:background-image="url({src})"
    style:background-position="{-frame.x}px {-frame.y}px"
></div>

<style>
  div {
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
</style>