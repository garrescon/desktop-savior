export const DEMO_MODE = true;
export const DEBUG = DEMO_MODE;

// --- perf measurement for v2 ---

interface Probe {
    calls: number;
    syncTotal: number;
    syncMax: number;
    tripTotal: number;
    tripMax: number;
    inFlight: number;
    inFlightMax: number;
    failed: number;
}

const probes = new Map<string, Probe>();
const flushers = new Map<string, ReturnType<typeof setTimeout>>();

const QUIET_MS = 1000;

function blank(): Probe {
    return {
        calls: 0, syncTotal: 0, syncMax: 0,
        tripTotal: 0, tripMax: 0,
        inFlight: 0, inFlightMax: 0, failed: 0,
    };
}

function report(label: string): void {
    const p = probes.get(label);
    probes.delete(label);
    flushers.delete(label);
    if (!p || !p.calls) return;

    const mean = (total: number) => (total / p.calls).toFixed(3);
    console.log(
        `[perf] ${label} · ${p.calls} calls`
        + ` · sync mean ${mean(p.syncTotal)}ms max ${p.syncMax.toFixed(3)}ms`
        + ` · trip mean ${mean(p.tripTotal)}ms max ${p.tripMax.toFixed(1)}ms`
        + ` · peak in-flight ${p.inFlightMax}`
        + (p.failed ? ` · ${p.failed} failed` : ""),
    );
}

export function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
    if (!DEBUG) return run();

    const existing = probes.get(label);
    const p: Probe = existing ?? blank();
    if (!existing) probes.set(label, p);

    const started = performance.now();
    const promise = run();
    const sync = performance.now() - started;

    p.calls += 1;
    p.syncTotal += sync;
    if (sync > p.syncMax) p.syncMax = sync;
    p.inFlight += 1;
    if (p.inFlight > p.inFlightMax) p.inFlightMax = p.inFlight;

    clearTimeout(flushers.get(label));
    flushers.set(label, setTimeout(() => report(label), QUIET_MS));

    const settle = (failed: boolean) => {
        const trip = performance.now() - started;
        p.tripTotal += trip;
        if (trip > p.tripMax) p.tripMax = trip;
        p.inFlight -= 1;
        if (failed) p.failed += 1;
    };

    return promise.then(
        (value) => { settle(false); return value; },
        (err) => { settle(true); throw err; },
    );
}
