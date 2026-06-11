'use client';

import type { TonNetwork } from '@/lib/network';
import { networkLabel } from '@/lib/network';

type Props = {
    value: TonNetwork;
    onChange: (network: TonNetwork) => void;
    disabled?: boolean;
};

export function NetworkSelector({ value, onChange, disabled }: Props) {
    return (
        <div className="network-selector" role="group" aria-label="Сеть TON">
            {(['testnet', 'mainnet'] as const).map((network) => (
                <button
                    key={network}
                    type="button"
                    className={`network-option ${value === network ? 'active' : ''}`}
                    disabled={disabled}
                    onClick={() => onChange(network)}
                >
                    {networkLabel(network)}
                </button>
            ))}
        </div>
    );
}
