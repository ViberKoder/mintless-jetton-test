'use client';

import { useCallback, useEffect, useState } from 'react';
import { Address } from '@ton/core';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TonConnectButton } from './TonConnectButton';

type IndexerStatus = {
    tonapiWorks: boolean;
    toncenterWorks: boolean;
    cacheStale: boolean;
    mintlessInfoIndexed: boolean;
    recommendedAction: 'wait' | 'bump_metadata_uri' | 'request_toncenter_indexing' | 'ready';
    toncenterCached: {
        customPayloadApiUri: string | null;
        mintlessMerkleDumpUri: string | null;
    };
    bumpTargetUri: string | null;
    supportMessage: string;
};

type SyncInfo = {
    needsSync: boolean;
    needsBump: boolean;
    bumpTargetUri: string | null;
    bumpMessage: {
        address: string;
        amount: string;
        payload: string;
    } | null;
};

type Props = {
    masterParam: string;
};

export function ToncenterIndexerPanel({ masterParam }: Props) {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [status, setStatus] = useState<IndexerStatus | null>(null);
    const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = useCallback(async () => {
        const [statusRes, syncRes] = await Promise.all([
            fetch(`/api/jettons/${masterParam}/indexer-status`),
            fetch(`/api/jettons/${masterParam}/sync-metadata`),
        ]);
        const statusData = await statusRes.json();
        const syncData = await syncRes.json();
        if (!statusRes.ok) {
            throw new Error(statusData.error || 'indexer-status failed');
        }
        setStatus(statusData);
        setSyncInfo(syncRes.ok ? syncData : null);
    }, [masterParam]);

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'));
    }, [load]);

    const sendTx = async (message: { address: string; amount: string; payload: string }, action: string) => {
        if (!wallet?.account?.address) {
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);
        try {
            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [message],
            });
            setSuccess(
                action === 'bump'
                    ? 'URI обновлён с ?v=… — Toncenter должен перекачать metadata в течение ~30 мин.'
                    : 'Транзакция отправлена.',
            );
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка отправки');
        } finally {
            setLoading(false);
        }
    };

    const handleBump = async () => {
        if (!wallet?.account?.address) {
            return;
        }
        const adminRaw = Address.parse(wallet.account.address).toRawString();
        const res = await fetch(`/api/jettons/${masterParam}/sync-metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminAddress: adminRaw, action: 'bump' }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || 'Не удалось подготовить bump');
            return;
        }
        await sendTx(data.message, 'bump');
    };

    if (!status) {
        return null;
    }

    if (status.toncenterWorks) {
        return (
            <div className="card">
                <h2>Toncenter / Tonscan / MyTonWallet</h2>
                <p style={{ color: 'var(--success)' }}>✓ mintless_info проиндексирован в Toncenter</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>Toncenter / Tonscan / MyTonWallet</h2>
            <p className="muted">
                Tonkeeper и Tonviewer используют <strong>TonAPI</strong> — у вас уже работает.
                Tonscan и MyTonWallet берут данные из <strong>Toncenter</strong> — им нужен{' '}
                <code>mintless_info</code> в <code>/jetton/wallets</code>.
            </p>
            <ul style={{ margin: '8px 0', paddingLeft: 18, fontSize: '0.9rem' }}>
                <li style={{ color: status.tonapiWorks ? 'var(--success)' : 'var(--muted)' }}>
                    TonAPI: {status.tonapiWorks ? '✓' : '○'} custom_payload_api_uri
                </li>
                <li style={{ color: status.cacheStale ? 'var(--danger)' : 'var(--success)' }}>
                    Toncenter metadata cache: {status.cacheStale ? 'устарел (старый путь)' : '✓ актуален'}
                </li>
                <li style={{ color: status.mintlessInfoIndexed ? 'var(--success)' : 'var(--danger)' }}>
                    Toncenter mintless_info: {status.mintlessInfoIndexed ? '✓ есть' : '✗ нет'}
                </li>
            </ul>

            {status.cacheStale && (
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                    <p>Кэш Toncenter всё ещё ссылается на старый путь:</p>
                    <div className="code">{status.toncenterCached.mintlessMerkleDumpUri ?? 'n/a'}</div>
                </div>
            )}

            {syncInfo?.needsBump && syncInfo.bumpMessage && (
                <div style={{ marginTop: 16 }}>
                    <p className="muted">
                        Шаг 1: принудительно обновить on-chain URI (<code>?v=2</code>), чтобы metadata-fetcher
                        Toncenter перекачал jetton.json с правильными ссылками.
                    </p>
                    <div className="code">{syncInfo.bumpTargetUri}</div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TonConnectButton />
                        <button type="button" className="primary" disabled={!wallet || loading} onClick={() => void handleBump()}>
                            {loading ? 'Отправка…' : 'Bump metadata URI для Toncenter'}
                        </button>
                    </div>
                </div>
            )}

            {status.recommendedAction === 'request_toncenter_indexing' && (
                <div style={{ marginTop: 16 }}>
                    <p className="muted">
                        Шаг 2: если через 30–60 мин после bump jetton всё ещё не виден — напишите в{' '}
                        <a href="https://t.me/toncenter" target="_blank" rel="noreferrer">
                            @toncenter
                        </a>{' '}
                        с запросом на индексацию mintless merkle dump:
                    </p>
                    <textarea
                        className="code"
                        readOnly
                        rows={8}
                        style={{ width: '100%', marginTop: 8, fontFamily: 'monospace', fontSize: '0.8rem' }}
                        value={status.supportMessage}
                        onFocus={(e) => e.target.select()}
                    />
                </div>
            )}

            {error && <p style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</p>}
            {success && <p style={{ color: 'var(--success)', marginTop: 12 }}>{success}</p>}
        </div>
    );
}
