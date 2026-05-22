import { Address } from '@ton/core';

/** URL path segment for raw master `0:...` */
export function masterToPath(master: Address): string {
    return encodeURIComponent(master.toRawString());
}

export function masterFromPath(segment: string): Address {
    return Address.parse(decodeURIComponent(segment));
}
