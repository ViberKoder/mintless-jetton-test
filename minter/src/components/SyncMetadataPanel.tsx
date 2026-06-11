'use client';

import { useCallback, useEffect, useState } from 'react';
import { Address } from '@ton/core';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TonConnectButton } from './TonConnectButton';

type SyncInfo = {
    currentUri: string | null;
    targetUri: string;
    needsSync: boolean;
    needsBump?: boolean;
    message: {
        address: string;
        amount: string;
        payload: string;
    };
};

type Props = {
    masterParam: string;
};

export function SyncMetadataPanel({ masterParam }: Props) {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [info, setInfo] = useState<SyncInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadInfo = useCallback(async () => {
        try {
            const res = await fetch(`/api/jettons/${masterParam}/sync-metadata`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось загрузить sync-metadata');
            }
            setInfo(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        }
    }, [masterParam]);

    useEffect(() => {
        void loadInfo();
    }, [loadInfo]);

    const handleSync = async () => {
        if (!wallet?.account?.address || !info?.needsSync) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const adminRaw = Address.parse(wallet.account.address).toRawString();
            const res = await fetch(`/api/jettons/${masterParam}/sync-metadata`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminAddress: adminRaw, action: 'sync' }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось подготовить транзакцию');
            }

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: data.message.address,
                        amount: data.message.amount,
                        payload: data.message.payload,
                    },
                ],
            });
            setSuccess('Транзакция отправлена. Toncenter переиндексирует metadata через несколько минут.');
            await loadInfo();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка отправки');
        } finally {
            setLoading(false);
        }
    };

    if (!info || (!info.needsSync && !info.needsBump)) {
        return null;
    }

    if (!info.needsSync) {
        return null;
    }

    return (
        <div className="card">
            <h2>Обновить on-chain metadata URI</h2>
            <p className="muted">
                В контракте сейчас старый путь metadata. Admin может обновить URI на on-chain master без redeploy.
            </p>
            <p className="muted">Текущий URI:</p>
            <div className="code">{info.currentUri ?? 'n/a'}</div>
            <p className="muted" style={{ marginTop: 12 }}>
                Целевой URI:
            </p>
            <div className="code">{info.targetUri}</div>
            <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <TonConnectButton />
                <button type="button" className="primary" disabled={!wallet || loading} onClick={() => void handleSync()}>
                    {loading ? 'Отправка…' : 'Sync metadata on-chain'}
                </button>
            </div>
            {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
            {success && <p style={{ color: 'var(--success)', marginTop: 12 }}>{success}</p>}
        </div>
    );
}
