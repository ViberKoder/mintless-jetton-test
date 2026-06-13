import { Address } from '@ton/core';

/** URL path segment for raw master `0:...` (on-chain metadata URI) */
export function masterToPath(master: Address): string {
    return encodeURIComponent(master.toRawString());
}

/** Friendly bounceable path for TEP-176 / Tonkeeper-style APIs */
export function masterToFriendlyPath(master: Address): string {
    return master.toString({ bounceable: true, urlSafe: true });
}

export function masterFromPath(segment: string): Address {
    return Address.parse(decodeURIComponent(segment));
}
