<script lang="ts">
    import type { AsepriteSheet, FrameTag } from './types';

    interface Props {
        src: string;
        sheet: AsepriteSheet;
        tag: FrameTag;
        scale?: number;
        loop?: boolean;
        flip?: boolean;
        onComplete?: () => void;
    }

    let { src, sheet, tag, scale = 4, loop = true, onComplete, flip = false      }: Props = $props();

    let frameIndex = $state(0);

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
    data-tauri-drag-region
    style:width="{frame.w * scale}px"
    style:height="{frame.h * scale}px"
    style:background-image="url({src})"
    style:background-size="{sheet.meta.size.w * scale}px {sheet.meta.size.h * scale}px"
    style:background-position="{-frame.x * scale}px {-frame.y * scale}px"
    style:transform="scaleX({flip ? -1 : 1})"
></div>

<style>
  div {
    background-repeat: no-repeat;
    image-rendering: pixelated;
  }
</style>