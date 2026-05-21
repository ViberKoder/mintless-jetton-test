export function getAppUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    }
    if (process.env.VERCEL_URL) {
        return normalizeUrl(process.env.VERCEL_URL);
    }
    return 'http://localhost:3000';
}

function normalizeUrl(url: string): string {
    const trimmed = url.replace(/\/$/, '');
    if (trimmed.startsWith('http')) {
        return trimmed;
    }
    return `https://${trimmed}`;
}

export function jettonMetadataUrl(jettonId: string): string {
    return `${getAppUrl()}/api/jettons/${jettonId}/jetton.json`;
}

export function jettonClaimApiUrl(jettonId: string): string {
    return `${getAppUrl()}/api/jettons/${jettonId}/wallet/{owner_raw_address}`;
}
