import { Address } from '@ton/core';
import { masterToFriendlyPath, masterToPath } from './master';

function isValidOrigin(url: string): boolean {
    try {
        const u = new URL(url);
        return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0 && u.hostname !== '/';
    } catch {
        return false;
    }
}

function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed || trimmed.includes('${{')) {
        return '';
    }
    try {
        if (/^https?:\/\//i.test(trimmed)) {
            return new URL(trimmed).origin;
        }
        return new URL(`https://${trimmed}`).origin;
    } catch {
        return '';
    }
}

export function getAppUrlFromHeaders(headers: Headers): string | null {
    const host = (headers.get('x-forwarded-host') ?? headers.get('host'))?.split(',')[0]?.trim();
    const proto = (headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
    if (!host) {
        return null;
    }
    const origin = normalizeUrl(`${proto}://${host}`);
    return isValidOrigin(origin) ? origin : null;
}

export function getAppUrl(): string {
    const candidates: string[] = [];

    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        candidates.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    if (process.env.NEXT_PUBLIC_APP_URL) {
        candidates.push(process.env.NEXT_PUBLIC_APP_URL);
    }
    if (process.env.VERCEL_URL) {
        candidates.push(process.env.VERCEL_URL);
    }

    for (const raw of candidates) {
        const origin = normalizeUrl(raw);
        if (isValidOrigin(origin)) {
            return origin;
        }
    }

    return 'http://localhost:3000';
}

export function resolveAppUrl(headers?: Headers): string {
    if (headers) {
        const fromRequest = getAppUrlFromHeaders(headers);
        if (fromRequest) {
            return fromRequest;
        }
    }
    return getAppUrl();
}

function masterAddress(master: Address | string): Address {
    return typeof master === 'string' ? Address.parse(master) : master;
}

/** On-chain metadata URI keeps raw path (minter address fixpoint). */
export function jettonMetadataUrl(master: Address | string, headers?: Headers): string {
    const addr = masterAddress(master);
    return `${resolveAppUrl(headers)}/api/jettons/${masterToPath(addr)}/jetton.json`;
}

/** TEP-176 v1 root with friendly master (Tonkeeper / Egg style). */
export function customPayloadApiRoot(master: Address | string, headers?: Headers): string {
    const addr = masterAddress(master);
    return `${resolveAppUrl(headers)}/api/v1/jettons/${masterToFriendlyPath(addr)}`;
}

export function jettonClaimApiUrl(master: Address | string, headers?: Headers): string {
    return `${customPayloadApiRoot(master, headers)}/wallet/{owner_raw_address}`;
}

export function mintlessMerkleDumpUrl(master: Address | string, headers?: Headers): string {
    return `${customPayloadApiRoot(master, headers)}/merkle-dump.boc`;
}

/** TEP-176 batch wallets root; append `?next_from=0:...&count=N` */
export function jettonWalletsBatchUrl(master: Address | string, headers?: Headers): string {
    return `${customPayloadApiRoot(master, headers)}/wallets?next_from={owner_raw}&count=100`;
}
