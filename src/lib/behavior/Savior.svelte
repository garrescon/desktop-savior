<script lang="ts">
    import { untrack } from "svelte";
    import { getCurrentWindow, currentMonitor, PhysicalPosition } from "@tauri-apps/api/window";
    import Sprite from "$lib/sprite/Sprite.svelte";
    import { GRAVITY as G, type Behavior } from "./types";
    import { pickWeighted } from "./random";
    import { trace } from "$lib/dev";

    import { ATTENTION_ID, FALL_ID } from "./behaviors";

    let { behaviors, onStash, attention = 0, summon = 0, onSummoned }: {
        behaviors: Behavior[],
        onStash?: () => void,
        // counts up so two reminders in a row register as two
        attention?: number,
        // counts up to ask Him to come to the middle of the work area
        summon?: number,
        onSummoned?: () => void,
    } = $props();
    let generation = $state(0);
    // true while someone else owns the window position (dragging or mid-fall)
    // timer and walk effects pause on it
    // starts true so a mount above the floor cannot race maybeFall into a mid-air walk
    let suspended = $state(true);

    type Segment = "intro" | "loop" | "outro";

    const dlog = trace;
    const win = getCurrentWindow();

    const HOP_APEX = 90;
    const HOP_SPAN = 130;

    const pool = $derived(behaviors.filter((b) => b.weight > 0));

    // svelte-ignore state_referenced_locally
    let behavior = $state<Behavior>(pickWeighted(pool, (b) => b.weight));
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

    // the one place a behavior is taken up, so restarting a repeat always works
    function adopt(next: Behavior) {
        behavior = next;
        segment = next.intro ? "intro" : "loop";
        generation++;
    }

    function startNextBehavior(from: Behavior[] = pool) {
        const next = pickWeighted(from, (b) => b.weight);
        dlog(`[pick #${generation + 1}] ${behavior.id} -> ${next.id}${next === behavior ? " (REPEAT)" : ""}`);
        adopt(next);
    }

    // any click interrupts a walk and restarts into a behavior that stands still
    const endWalk = () => startNextBehavior(pool.filter((b) => !b.movement));

    function headed(direction: 1 | -1) {
        return pool.filter((b) => b.movement?.direction === direction);
    }

    function play(id: string) {
        const found = behaviors.find((b) => b.id === id);
        if (found) adopt(found);
        return Boolean(found);
    }

    // the sheets are drawn facing so reversing means a different sheet
    function turn(direction: 1 | -1) {
        const facing = headed(direction);
        if (facing.length) startNextBehavior(facing);
        else endWalk();
    }

    // every window write needs the same geometry so read it once
    async function readStage() {
        const [monitor, pos, size] = await Promise.all([
            currentMonitor(), win.outerPosition(), win.outerSize(),
        ]);
        if (!monitor) return null;
        const area = monitor.workArea;
        return {
            pos,
            size,
            area,
            minX: area.position.x,
            maxX: area.position.x + area.size.width - size.width,
            floorY: area.position.y + area.size.height - size.height,
        };
    }

    // gravity hands this out so a release can ask for a decision straight away
    let recheckFloor: (() => void) | undefined;

    $effect(() => {
        const down = () => { suspended = true; };
        const up = () => {
            suspended = false;
            recheckFloor?.();
        };
        window.addEventListener("pointerdown", down);
        window.addEventListener("pointerup", up);
        return () => {
            window.removeEventListener("pointerdown", down);
            window.removeEventListener("pointerup", up);
        };
    });

    // the one-shot hands back to the weighted pick so nothing needs clearing
    // untracked because adopt bumps generation
    // an effect that reads and writes one state never settles
    $effect(() => {
        if (!attention) return;
        untrack(() => {
            if (play(ATTENTION_ID)) dlog(`[attention] (#${attention})`);
        });
    });

    $effect(() => {
        if (!summon) return;
        let disposed = false;
        let rafId = 0;
        // set before the await so the walk is already stood down
        suspended = true;

        (async () => {
            const stage = await readStage();
            if (disposed) return;

            const arrive = () => {
                suspended = false;
                onSummoned?.();
            };

            if (!stage) { arrive(); return; }

            const { pos, minX, maxX, floorY } = stage;
            // He is drawn centred in both windows so the resize moves Him nowhere
            const targetX = minX + Math.round((maxX - minX) / 2);
            const span = targetX - pos.x;

            if (Math.abs(span) < 1) {
                win.setPosition(new PhysicalPosition(targetX, floorY)).catch(console.warn);
                arrive();
                return;
            }

            const facing = headed(span > 0 ? 1 : -1);
            if (facing.length) adopt(facing[0]);

            const hops = Math.max(1, Math.round(Math.abs(span) / HOP_SPAN));
            const vy0 = -Math.sqrt(2 * G * HOP_APEX);
            const flight = (-2 * vy0) / G;
            dlog(`[summon] ${hops} hop(s) over ${span}px`);

            let hop = 0;
            let t = 0;
            let last = performance.now();

            const step = (now: number) => {
                if (disposed) return;
                t += Math.min((now - last) / 1000, 0.05);
                last = now;

                // the remainder carries so the arc never snaps at a landing
                if (t >= flight) { hop++; t -= flight; }
                if (hop >= hops) {
                    win.setPosition(new PhysicalPosition(targetX, floorY)).catch(console.warn);
                    dlog("[summon] arrived");
                    arrive();
                    return;
                }

                const x = pos.x + (span * hop) / hops + (span / hops / flight) * t;
                const y = floorY + vy0 * t + 0.5 * G * t * t;
                win.setPosition(new PhysicalPosition(
                    Math.round(x), Math.round(Math.min(y, floorY)),
                )).catch(console.warn);
                rafId = requestAnimationFrame(step);
            };
            rafId = requestAnimationFrame(step);
        })().catch(console.warn);

        return () => {
            disposed = true;
            cancelAnimationFrame(rafId);
        };
    });

    $effect(() => {
        if (suspended) return
        // forces generation to be a dependency
        // without it the same behavior twice leaves behavior and segment unchanged
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
            const stage = await readStage();
            if (disposed || !stage) return;

            const { minX, maxX } = stage;
            let x = stage.pos.x;
            const y = stage.pos.y;
            // no room to walk makes every frame an edge hit
            if (maxX <= minX) { endWalk(); return; }

            const dir = movement.direction;
            let last = performance.now();
            dlog(`[walk] ${behavior.id} dir=${dir} from x=${x} minX=${minX} maxX=${maxX}`);

            const step = (now: number) => {
                if (disposed) return;
                const dt = Math.min((now - last) / 1000, 0.1);
                last = now;
                x += dir * movement.speed * dt;
                // direction matters or a window dragged out of bounds turns on its first frame
                // no snap because a frame overshoots the edge by about a pixel
                if (dir < 0 && x <= minX) {
                    dlog(`[walk] reached the left edge at ${Math.round(x)}`);
                    turn(1);
                    return;
                }
                if (dir > 0 && x >= maxX) {
                    dlog(`[walk] reached the right edge at ${Math.round(x)}`);
                    turn(-1);
                    return;
                }
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

        const BOUNCE = 0.25;
        // a drag has ended when window moves stop arriving for this long
        const QUIESCENCE_MS = 450;
        // landings slower than this don't bounce
        const BOUNCE_MIN_SPEED = 400;

        (async () => {
            const stage = await readStage();
            if (disposed) return;
            // never leave Him frozen just because the monitor could not be read
            if (!stage) { suspended = false; return; }
            const { size, area, minX, floorY } = stage;

            // a fall writes the same x every frame so a different one means another owner
            // usually that is a drag which never announced its end
            // two writers at 60fps pin Him wherever the fall started
            let fallingX: number | null = null;

            function releaseFall() {
                if (fallingX === null) return;
                fallingX = null;
                cancelAnimationFrame(rafId);
                removeGrab?.();
                removeGrab = undefined;
                dlog("[gravity] fall released, something else owns the position");
            }

            // suspends behavior while He is above the floor
            // deliberately does not check suspended first
            // Windows does not deliver pointerup after a drag so that flag can stick true forever
            // landing and floor quiescence are the reset points
            async function maybeFall() {
                if (disposed) return;
                const pos = await win.outerPosition();
                if (disposed) return;
                dlog(
                    `[gravity] check pos=(${pos.x},${pos.y}) floor=${floorY}` +
                    ` win=${size.width}x${size.height}` +
                    ` area=(${area.size.width}x${area.size.height})` +
                    ` suspended=${suspended}`,
                );
                if (pos.y >= floorY - 1) {
                    dlog("[gravity] already on the floor");
                    // dropped by a drag rather than by a fall so the pose still needs clearing
                    if (behavior.id === FALL_ID) startNextBehavior();
                    suspended = false;
                    return;
                }

                suspended = true;

                let y = pos.y;
                let vy = 0;
                let last = performance.now();

                const STASH_ZONE = 140;
                // the same corner the stash window sits in
                const nearCorner = pos.x <= minX + STASH_ZONE && pos.y >= floorY - STASH_ZONE;

                // ungated for the same reason maybeFall is
                dlog(`[gravity] nearCorner=${nearCorner} zone=${STASH_ZONE}`);
                if (nearCorner) {
                    dlog("[gravity] stashing");
                    onStash?.();
                    return;
                }
                dlog(`[gravity] falling from y=${y} to floor=${floorY}`);
                fallingX = pos.x;
                play(FALL_ID);

                let grabbed = false;
                const grab = () => { grabbed = true; };
                window.addEventListener("pointerdown", grab, { once: true });
                // the teardown needs a way to unhook grab if the component dies mid-fall
                // once:true only fires if a click actually happens
                removeGrab = () => window.removeEventListener("pointerdown", grab);

                const step = (now: number) => {
                    if (disposed || grabbed) { fallingX = null; return; }
                    const dt = Math.min((now - last) / 1000, 0.05);
                    last = now;
                    vy += G * dt;
                    y += vy * dt;
                    if (y >= floorY) {
                        y = floorY;
                        if (vy > BOUNCE_MIN_SPEED) {
                            vy = -vy * BOUNCE;
                        } else {
                            win.setPosition(new PhysicalPosition(pos.x, floorY)).catch(console.warn);
                            dlog("[gravity] landed");
                            window.removeEventListener("pointerdown", grab);
                            fallingX = null;
                            startNextBehavior();
                            suspended = false;
                            return;
                        }
                    }
                    win.setPosition(new PhysicalPosition(pos.x, Math.round(y))).catch(console.warn);
                    rafId = requestAnimationFrame(step);
                };
                rafId = requestAnimationFrame(step);
            }

            const fn = await win.onMoved(({ payload }) => {
                // our own writes come back exactly so anything further is a drag
                if (fallingX !== null && Math.abs(payload.x - fallingX) > 1) releaseFall();
                clearTimeout(quietTimer);
                quietTimer = setTimeout(() => { maybeFall().catch(console.warn); }, QUIESCENCE_MS);
            });
            if (disposed) { fn(); return; }
            unlisten = fn;

            // a release is the one moment we know a drag is over
            recheckFloor = () => { maybeFall().catch(console.warn); };

            maybeFall().catch(console.warn);
        })().catch(console.warn);

        return () => {
            disposed = true;
            recheckFloor = undefined;
            cancelAnimationFrame(rafId);
            clearTimeout(quietTimer);
            unlisten?.();
            removeGrab?.();
        };
    });

    
</script>

{#key generation}
    <Sprite src={behavior.src} sheet={behavior.sheet} tag={currentTag} loop={looping} onComplete={advance} />
{/key}