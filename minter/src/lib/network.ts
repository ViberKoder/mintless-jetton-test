import { CHAIN } from '@tonconnect/ui-react';

export type TonNetwork = 'mainnet' | 'testnet';

export const NETWORK_STORAGE_KEY = 'mintless-minter-network';

export function defaultTonNetwork(): TonNetwork {
    return process.env.NEXT_PUBLIC_TON_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

export function chainIdForNetwork(network: TonNetwork): string {
    return network === 'mainnet' ? CHAIN.MAINNET : CHAIN.TESTNET;
}

export function networkFromChainId(chain: string | undefined): TonNetwork | null {
    if (chain === CHAIN.MAINNET) {
        return 'mainnet';
    }
    if (chain === CHAIN.TESTNET) {
        return 'testnet';
    }
    return null;
}

export function networkLabel(network: TonNetwork): string {
    return network === 'mainnet' ? 'Mainnet' : 'Testnet';
}

export function readStoredNetwork(): TonNetwork | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const saved = localStorage.getItem(NETWORK_STORAGE_KEY);
    return saved === 'mainnet' || saved === 'testnet' ? saved : null;
}

export function storeNetwork(network: TonNetwork): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(NETWORK_STORAGE_KEY, network);
    }
}
