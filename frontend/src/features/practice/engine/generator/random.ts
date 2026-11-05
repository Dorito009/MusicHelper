// Small seeded random number generator, so an exercise can be regenerated from its seed.

export interface Random {
    /** 0 <= n < 1 */
    next(): number;
    pick<T>(items: readonly T[]): T;
    weighted<T>(items: readonly T[], weight: (item: T) => number): T;
}

/** cyrb53-style string hash to a 32-bit seed. */
function hashSeed(seed: string): number {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < seed.length; i++) {
        const ch = seed.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
}

/** mulberry32 */
export function createRandom(seed: string): Random {
    let state = hashSeed(seed);
    const next = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        pick: (items) => items[Math.floor(next() * items.length)],
        weighted: (items, weight) => {
            const weights = items.map((item) => Math.max(0, weight(item)));
            const total = weights.reduce((a, b) => a + b, 0);
            if (total <= 0) return items[Math.floor(next() * items.length)];
            let r = next() * total;
            for (let i = 0; i < items.length; i++) {
                r -= weights[i];
                if (r < 0) return items[i];
            }
            return items[items.length - 1];
        },
    };
}

/** A short, readable seed like "k3f9qz". */
export function randomSeed(): string {
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
}

/** Short stable id for a string (used to give each exercise an id). */
export function shortHash(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}
