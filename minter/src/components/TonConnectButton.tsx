'use client';

import { TonConnectUIProvider, TonConnectButton } from '@tonconnect/ui-react';

const manifestUrl =
    typeof window !== 'undefined'
        ? `${window.location.origin}/tonconnect-manifest.json`
        : process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`
          : 'http://localhost:3000/tonconnect-manifest.json';

export function TonConnectProvider({ children }: { children: React.ReactNode }) {
    return <TonConnectUIProvider manifestUrl={manifestUrl}>{children}</TonConnectUIProvider>;
}

export { TonConnectButton };
