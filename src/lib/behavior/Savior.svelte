<script lang="ts">
    import { getCurrentWindow, currentMonitor, PhysicalPosition } from "@tauri-apps/api/window";
    import Sprite from "$lib/sprite/Sprite.svelte";
    import type { Behavior } from "./types";
    import { pickWeighted } from "./random";
    
    let { behaviors, onStash }: { behaviors: Behavior[], onStash?: () => void } = $props();
    let generation = $state(0);
    let facing = $state<1 | -1>(1);
    // true while someone else owns the window position (dragging or mid-fall)
    // timer and walk effects pause on it
    let suspended = $state(false);

    type Segment = "intro" | "loop" | "outro";

    const DEBUG = true;
    const t = () => (performance.now() / 1000).toFixed(2);
    const dlog = (msg: string) => { if (DEBUG) console.log(`${t()} ${msg}`); };
    const win = getCurrentWindow();

    // svelte-ignore state_referenced_locally
    let behavior = $state<Behavior>(pickWeighted(behaviors, (b) => b.weight));
    // svelte-ignore state_referenced_locally
    let segment = $state<Segment>(behavior.intro ? "intro" : "loop");

    const currentTag = $derived(
        segment === "intro" ? behavior.intro ?? behavior.loop
        : segment === "outro" ? behavior.outro ?? behavior.loop
        : behavior.loop
    );

    const looping = $derived(
        segment === "loop" && behavior.termination.kind === "duration"
    );

    function advance() {
        if (segment === "intro") {
            segment = "loop";
        } else if (segment === "loop" && behavior.outro) {
            segment = "outro";
        } else {
            startNextBehavior();
        }
    }

    function startNextBehavior(pool: Behavior[] = behaviors) {
        const next = pickWeighted(pool, (b) => b.weight);
        dlog(`[pick #${generation + 1}] ${behavior.id} -> ${next.id}${next === behavior ? " (REPEAT)" : ""}`);
        behavior = next;
        segment = next.intro ? "intro" : "loop";
        generation++;
    }

    // any click interrupts a walk
    const endWalk = () => startNextBehavior(behaviors.filter((b) => !b.movement));

    $effect(() => {
        const down = () => (suspended = true);
        const up = () => (suspended = false);
        window.addEventListener("pointerdown", down);
        window.addEventListener("pointerup", up);
        return () => {
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointerup", up);
        };
    });

    $effect(() => {
        if (suspended) return
        // forces generation to be a dependancy
        // without it, same behavior twice leaves behavior and segment unchanged
        void generation;
        if (segment !== "loop" || behavior.termination.kind !== "duration") return;
        const { minMs, maxMs } = behavior.termination;
        const ms = minMs + Math.random() * (maxMs - minMs);
        dlog(`[timer] armed for ${(ms / 1000).toFixed(1)}s (${behavior.id})`);
        const id = setTimeout(() => {
            dlog(`[timer] fired (${behavior.id})`);
            advance();
        }, ms);
        return () => {
            dlog(`[timer] disarmed (${behavior.id})`);
            clearTimeout(id);
        };
    });

    $effect(() => {
        if (suspended) return;
        const movement = behavior.movement;
        if (!movement || segment !== "loop") return;
        void generation;

        let disposed = false;
        let rafId = 0;

        window.addEventListener("pointerdown", endWalk);

        (async () => {
            const [monitor, pos, size] = await Promise.all([
                currentMonitor(), win.outerPosition(), win.outerSize(),
            ]);
            if (disposed || !monitor) return;

            const area = monitor.workArea;
            let x = pos.x;
            const y = pos.y;
            const minX = area.position.x;
            const maxX = area.position.x + area.size.width - size.width;

            let dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
            facing = dir;
            let last = performance.now();

            const step = (now: number) => {
                if (disposed) return;
                const dt = Math.min((now - last) / 1000, 0.1);
                last = now;
                x += dir * movement.speed * dt;
                if (x <= minX) { x = minX; dir = 1; facing = dir; }
                else if (x >= maxX) { x = maxX; dir = -1; facing = dir; }
                win.setPosition(new PhysicalPosition(Math.round(x), y)).catch(console.warn);
                rafId = requestAnimationFrame(step);
            };
            rafId = requestAnimationFrame(step);
        })().catch(console.warn);

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
            window.removeEventListener("pointerdown", endWalk);
        };
    });

    $effect(() => {
        let disposed = false;
        let rafId = 0;
        let quietTimer: ReturnType<typeof setTimeout>;
        let unlisten: (() => void) | undefined;
        let removeGrab: (() => void) | undefined;

        const G = 3000;
        const BOUNCE = 0.25;
        // a drag has ended when window moves stop arriving for this long
        const QUIESCENCE_MS = 450;
        // landings slower than this don't bounce
        const BOUNCE_MIN_SPEED = 400;

        (async () => {
            const [monitor, size] = await Promise.all([currentMonitor(), win.outerSize()]);
            if (disposed || !monitor) return;
            const area = monitor.workArea;
            const floorY = area.position.y + area.size.height - size.height;
            
            // Suspends behavior state while above floor level until
            // the window lands, is grabbed, or is stashed
            //
            // Deliberately doesn't check suspended first. Windows doesn't
            // give pointerup after dragging ends(?) so the flag can be stuck true.
            // Landing and floor quiescence are reset points.
            async function maybeFall() {
                if (disposed) return;
                dlog(`[gravity] maybeFall check (suspended=${suspended})`);
                const pos = await win.outerPosition();
                if (disposed) return;
                if (pos.y >= floorY - 1) {
                    suspended = false;
                    return;
                }

                suspended = true;

                let y = pos.y;
                let vy = 0;
                let last = performance.now();

                const STASH_ZONE = 140;
                const nearCorner =
                    pos.x + size.width >= area.position.x + area.size.width - STASH_ZONE &&
                    pos.y + size.height >= area.position.y + area.size.height - STASH_ZONE;
                
                if (nearCorner) { 
                    onStash?.(); 
                    return; 
                }
                dlog(`[gravity] falling from y=${y} to floor=${floorY}`);

                let grabbed = false;
                const grab = () => { grabbed = true; };
                window.addEventListener("pointerdown", grab, { once: true });
                // Gives the effect teardown a way to unhook grab if the compoonent dies
                // mid-fall. once:true only fires if a click happens
                removeGrab = () => window.removeEventListener("pointerdown", grab);

                const step = (now: number) => {
                    if (disposed || grabbed) return;
                    const dt = Math.min((now - last) / 1000, 0.05);
                    last = now;
                    vy += G * dt;
                    y += vy * dt;
                    if (y >= floorY) {
                        y = floorY;
                        if (vy > BOUNCE_MIN_SPEED && BOUNCE > 0) {
                            vy = -vy * BOUNCE;
                        } else {
                            win.setPosition(new PhysicalPosition(pos.x, floorY)).catch(console.warn);
                            dlog("[gravity] landed");
                            window.removeEventListener("pointerdown", grab);
                            suspended = false;
                            return;
                        }
                    }
                    win.setPosition(new PhysicalPosition(pos.x, Math.round(y))).catch(console.warn);
                    rafId = requestAnimationFrame(step);
                };
                rafId = requestAnimationFrame(step);
            }

            const fn = await win.onMoved(() => {
                clearTimeout(quietTimer);
                quietTimer = setTimeout(() => { maybeFall().catch(console.warn); }, QUIESCENCE_MS);
            });
            if (disposed) { fn(); return; }
            unlisten = fn;

            maybeFall().catch(console.warn);
        })().catch(console.warn);

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
            clearTimeout(quietTimer);
            unlisten?.();
            removeGrab?.();
        };
    });

    
</script>

{#key generation}
    <Sprite src={behavior.src} sheet={behavior.sheet} tag={currentTag} loop={looping} onComplete={advance} flip={facing === -1} />
{/key}