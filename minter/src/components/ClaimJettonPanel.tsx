'use client';

import { useCallback, useEffect, useState } from 'react';
import { Address, Cell } from '@ton/core';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TonConnectButton } from './TonConnectButton';
import {
    buildClaimTransferPayload,
    isClaimApiResponse,
    type ClaimApiResponse,
} from '@/lib/claimTransfer';

function bytesToBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

type Props = {
    masterParam: string;
    jettonName: string;
    jettonSymbol: string;
    decimals: number;
};

function formatJettonAmount(amount: string, decimals: number): string {
    const value = BigInt(amount);
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const frac = value % base;
    if (frac === 0n) {
        return whole.toString();
    }
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole}.${fracStr}`;
}

export function ClaimJettonPanel({ masterParam, jettonName, jettonSymbol, decimals }: Props) {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const [loading, setLoading] = useState(false);
    const [claim, setClaim] = useState<ClaimApiResponse | null>(null);
    const [notEligible, setNotEligible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadEligibility = useCallback(async () => {
        if (!wallet?.account?.address) {
            setClaim(null);
            setNotEligible(false);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);
        setNotEligible(false);

        try {
            const ownerRaw = Address.parse(wallet.account.address).toRawString();
            const res = await fetch(`/api/jettons/${masterParam}/wallet/${encodeURIComponent(ownerRaw)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось проверить airdrop');
            }
            if (!isClaimApiResponse(data)) {
                setClaim(null);
                setNotEligible(true);
                return;
            }
            setClaim(data);
        } catch (e) {
            setClaim(null);
            setError(e instanceof Error ? e.message : 'Ошибка загрузки');
        } finally {
            setLoading(false);
        }
    }, [masterParam, wallet?.account?.address]);

    useEffect(() => {
        void loadEligibility();
    }, [loadEligibility]);

    async function handleClaim() {
        if (!wallet?.account?.address || !claim) {
            return;
        }

        setError(null);
        setSuccess(null);
        setLoading(true);

        try {
            const owner = Address.parse(wallet.account.address);
            const customPayload = Cell.fromBoc(Buffer.from(claim.custom_payload, 'base64'))[0];
            const transferBody = buildClaimTransferPayload({
                jettonAmount: 1n,
                destination: owner,
                responseDestination: owner,
                customPayload,
            });

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [
                    {
                        address: Address.parse(claim.jetton_wallet).toString({
                            bounceable: true,
                            urlSafe: true,
                        }),
                        amount: '300000000',
                        stateInit: claim.state_init,
                        payload: bytesToBase64(transferBody.toBoc()),
                    },
                ],
            });

            setSuccess(
                'Транзакция отправлена. После подтверждения jetton появится в кошельке как обычный баланс.',
            );
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Claim не удался';
            if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    }

    const amountLabel =
        claim?.compressed_info?.amount != null
            ? formatJettonAmount(claim.compressed_info.amount, decimals)
            : null;

    return (
        <div className="card">
            <h2>Получить {jettonSymbol}</h2>
            <p className="muted">
                Mintless jetton не виден в кошельке, пока вы не заклеймите его. Tonkeeper и MyTonWallet
                показывают unclaimed баланс только если проиндексировали merkle dump — для кастомных
                jetton это не гарантировано. Здесь можно заклеймить вручную через TON Connect (~0.3 TON
                на gas).
            </p>

            <div style={{ marginBottom: 16 }}>
                <TonConnectButton />
            </div>

            {!wallet?.account?.address && (
                <p className="muted">Подключите кошелёк, чтобы проверить eligibility.</p>
            )}

            {wallet?.account?.address && loading && <p className="muted">Проверяем airdrop…</p>}

            {wallet?.account?.address && !loading && notEligible && (
                <p className="muted">Этот адрес не в списке получателей airdrop.</p>
            )}

            {wallet?.account?.address && !loading && claim && (
                <>
                    <p>
                        Доступно: <strong>{amountLabel}</strong> {jettonSymbol} ({jettonName})
                    </p>
                    <button type="button" className="btn" disabled={loading} onClick={() => void handleClaim()}>
                        {loading ? 'Отправка…' : `Заклеймить ${jettonSymbol}`}
                    </button>
                </>
            )}

            {error && <p className="error">{error}</p>}
            {success && <div className="success-box">{success}</div>}
        </div>
    );
}
