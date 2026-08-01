<script lang="ts">
    import type { AsepriteSheet, FrameTag } from './types';
    import { hitbox } from "$lib/stage/hitbox";

    interface Props {
        src: string;
        sheet: AsepriteSheet;
        tag: FrameTag;
        scale?: number;
        loop?: boolean;
        // off wherever a press means something other than moving the window
        grabbable?: boolean;
        onComplete?: () => void;
    }

    let { src, sheet, tag, scale = 4, loop = true, grabbable = true, onComplete }: Props = $props();

    let frameIndex = $state(0);

    // ?? guards the render between a sheet swap and the effect resetting
    // frameIndex, when the old index can point past the new sheet's frames
    const frame = $derived((sheet.frames[frameIndex] ?? sheet.frames[0]).frame);

    $effect(() => {
        const { from, to } = tag;
        frameIndex = from;

        let elapsed = 0;
        let last = performance.now();
        let rafId = requestAnimationFrame(function tick(now) {
            elapsed += Math.min(now - last, 100);
            last = now;
            const duration = sheet.frames[frameIndex].duration;
            if (elapsed >= duration) {
                // the remainder carries into the next frame so
                // timing doesn't drift against the sheet
                elapsed -= duration;
                if (frameIndex >= to ) {
                    if (!loop) {
                        onComplete?.();
                        return;
                    }
                    frameIndex = from;
                } else {
                    frameIndex++;
                }
            }
            rafId = requestAnimationFrame(tick);
        });

        return () => cancelAnimationFrame(rafId);
    });
</script>

<div
    use:hitbox
    data-tauri-drag-region={grabbable ? "" : undefined}
    style:width="{frame.w * scale}px"
    style:height="{frame.h * scale}px"
    style:background-image="url({src})"
    style:background-size="{sheet.meta.size.w * scale}px {sheet.meta.size.h * scale}px"
    style:background-position="{-frame.x * scale}px {-frame.y * scale}px"
></div>

<style>
  /* His window's main is a flex column and a bubble above Him would shrink this box */
  /* the clipped feet read as Him sinking through the floor */
  div {
    flex-shrink: 0;
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
</style>