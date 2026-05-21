export function getAppUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!url) {
        return 'http://localhost:3000';
    }
    if (url.startsWith('http')) {
        return url.replace(/\/$/, '');
    }
    return `https://${url}`.replace(/\/$/, '');
}

export function jettonMetadataUrl(jettonId: string): string {
    return `${getAppUrl()}/api/jettons/${jettonId}/jetton.json`;
}

export function jettonClaimApiUrl(jettonId: string): string {
    return `${getAppUrl()}/api/jettons/${jettonId}/wallet/{owner_raw_address}`;
}
