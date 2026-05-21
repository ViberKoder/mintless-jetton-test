'use client';

import { TonConnectUIProvider, TonConnectButton } from '@tonconnect/ui-react';

function getManifestUrl(): string {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/tonconnect-manifest.json`;
    }
    return 'http://localhost:3000/tonconnect-manifest.json';
}

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
    return <TonConnectUIProvider manifestUrl={getManifestUrl()}>{children}</TonConnectUIProvider>;
}

export { TonConnectButton };
