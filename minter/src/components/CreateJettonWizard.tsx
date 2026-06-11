'use client';

import { useEffect, useState } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { TonConnectButton } from './TonConnectButton';
import { NetworkSelector } from './NetworkSelector';
import { masterToPath } from '@/lib/master';
import { Address } from '@ton/core';
import {
    chainIdForNetwork,
    defaultTonNetwork,
    networkFromChainId,
    networkLabel,
    readStoredNetwork,
    storeNetwork,
    type TonNetwork,
} from '@/lib/network';

const AIRDROP_EXAMPLE = `[
  {
    "owner": "0:0000000000000000000000000000000000000000000000000000000000000001",
    "amount": "1000000000",
    "start_from": 1735689600,
    "expire_at": 1893456000
  }
]`;

type Preview = {
    minterAddressRaw: string;
    minterPath: string;
    merkleRoot: string;
    recipientCount: number;
    totalSupply: string;
    metadataUri: string;
};

type DeployInfo = {
    minterAddress: string;
    minterAddressRaw: string;
    metadataUri: string;
    claimApiUrl: string;
};

function walletMatchesNetwork(walletChain: string | undefined, network: TonNetwork): boolean {
    return walletChain === chainIdForNetwork(network);
}

export function CreateJettonWizard() {
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [network, setNetwork] = useState<TonNetwork>(defaultTonNetwork);

    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [decimals, setDecimals] = useState(9);
    const [description, setDescription] = useState('');
    const [image, setImage] = useState('');
    const [airdropJson, setAirdropJson] = useState(AIRDROP_EXAMPLE);

    const [preview, setPreview] = useState<Preview | null>(null);
    const [deployed, setDeployed] = useState<DeployInfo | null>(null);

    useEffect(() => {
        const saved = readStoredNetwork();
        if (saved) {
            setNetwork(saved);
        }
    }, []);

    useEffect(() => {
        storeNetwork(network);
        tonConnectUI.setConnectionNetwork(chainIdForNetwork(network));
    }, [network, tonConnectUI]);

    function handleNetworkChange(next: TonNetwork) {
        setError(null);
        if (wallet && !walletMatchesNetwork(wallet.account.chain, next)) {
            setError(
                `Смените сеть в кошельке или отключите его и подключите снова в ${networkLabel(next)}.`,
            );
        }
        setNetwork(next);
    }

    function ensureWalletNetwork(): boolean {
        if (!wallet?.account?.address) {
            setError('Подключите кошелёк TON Connect');
            return false;
        }
        if (!walletMatchesNetwork(wallet.account.chain, network)) {
            const connected = networkFromChainId(wallet.account.chain);
            setError(
                connected
                    ? `Кошелёк в ${networkLabel(connected)}, а выбрана сеть ${networkLabel(network)}. Переключите сеть или переподключите кошелёк.`
                    : `Кошелёк подключён к неизвестной сети (${wallet.account.chain}). Нужна ${networkLabel(network)}.`,
            );
            return false;
        }
        return true;
    }

    async function handleCreateDraft() {
        if (!ensureWalletNetwork()) {
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const res = await fetch('/api/jettons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    symbol,
                    decimals,
                    description,
                    image,
                    airdropJson,
                    adminAddress: wallet!.account.address,
                    network,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка создания');

            const master = Address.parse(data.minterAddressRaw);
            setPreview({
                minterAddressRaw: data.minterAddressRaw,
                minterPath: masterToPath(master),
                merkleRoot: data.merkleRoot,
                recipientCount: data.recipientCount,
                totalSupply: data.totalSupply,
                metadataUri: data.metadataUri,
            });
            setStep(3);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeploy() {
        if (!preview || !ensureWalletNetwork()) {
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const deployRes = await fetch(`/api/jettons/${preview.minterPath}/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminAddress: wallet!.account.address }),
            });
            const deployData = await deployRes.json();
            if (!deployRes.ok) throw new Error(deployData.error || 'Ошибка подготовки деплоя');

            await tonConnectUI.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 600,
                network: chainIdForNetwork(network),
                messages: [
                    {
                        address: deployData.minterAddress,
                        amount: deployData.deployAmount,
                        stateInit: deployData.stateInitBoc,
                        payload: deployData.deployPayloadBoc,
                    },
                ],
            });

            const patchPath = masterToPath(Address.parse(deployData.minterAddressRaw));
            await fetch(`/api/jettons/${patchPath}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'deployed',
                    adminAddress: wallet!.account.address,
                    deployedMinterAddress: deployData.minterAddressRaw,
                    network,
                }),
            });

            const base = window.location.origin;
            const deployedPath = masterToPath(Address.parse(deployData.minterAddressRaw));
            setDeployed({
                minterAddress: deployData.minterAddress,
                minterAddressRaw: deployData.minterAddressRaw,
                metadataUri: deployData.metadataUri,
                claimApiUrl: `${base}/api/jettons/${deployedPath}/wallet/{owner_raw}`,
            });
            setPreview({ ...preview, minterPath: deployedPath, minterAddressRaw: deployData.minterAddressRaw });
            setStep(4);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Деплой отменён или не удался';
            if (!msg.toLowerCase().includes('reject') && !msg.toLowerCase().includes('cancel')) {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    }

    const steps = [
        { n: 1, label: 'Кошелёк' },
        { n: 2, label: 'Данные' },
        { n: 3, label: 'Проверка' },
        { n: 4, label: 'Готово' },
    ];

    const walletNetwork = networkFromChainId(wallet?.account.chain);
    const walletOk = wallet ? walletMatchesNetwork(wallet.account.chain, network) : false;

    return (
        <div>
            <div className="steps">
                {steps.map((s) => (
                    <span
                        key={s.n}
                        className={`step ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}
                    >
                        {s.n}. {s.label}
                    </span>
                ))}
            </div>

            {step === 1 && (
                <div className="card">
                    <h2>1. Сеть и кошелёк</h2>
                    <p className="muted">
                        Выберите сеть деплоя. Testnet удобен для проверки mintless и индексации без ожидания
                        кэша mainnet.
                    </p>
                    <NetworkSelector value={network} onChange={handleNetworkChange} disabled={loading} />
                    {network === 'testnet' && (
                        <p className="muted">
                            На testnet нужен testnet-кошелёк с TON. Если claim падает с library error — один раз
                            выполните <code>deployLibrary</code> из корня репозитория на testnet.
                        </p>
                    )}
                    <p className="muted">
                        Этот адрес станет admin jetton-minter. Деплой minter стоит ~1.5 TON в выбранной сети.
                    </p>
                    <TonConnectButton />
                    {wallet && (
                        <p className="muted" style={{ marginTop: 12 }}>
                            Подключён: <span className="code">{wallet.account.address}</span>
                            <br />
                            Сеть кошелька:{' '}
                            <strong style={{ color: walletOk ? 'var(--success)' : 'var(--error)' }}>
                                {walletNetwork ? networkLabel(walletNetwork) : wallet.account.chain}
                            </strong>
                        </p>
                    )}
                    {error && <p className="error">{error}</p>}
                    <div style={{ marginTop: 16 }}>
                        <button className="btn" disabled={!wallet || !walletOk} onClick={() => setStep(2)}>
                            Далее
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="card">
                    <h2>2. Метаданные и airdrop ({networkLabel(network)})</h2>
                    <p className="muted">
                        JSON airdrop: owner в raw-формате <code>0:...</code> для <strong>той же сети</strong>,
                        amount в nanojettons, start_from / expire_at — unix time.
                    </p>

                    <div className="field">
                        <label>Название</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Token" />
                    </div>
                    <div className="field">
                        <label>Символ</label>
                        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="MTK" />
                    </div>
                    <div className="field">
                        <label>Decimals</label>
                        <input
                            type="number"
                            value={decimals}
                            onChange={(e) => setDecimals(Number(e.target.value))}
                        />
                    </div>
                    <div className="field">
                        <label>Описание</label>
                        <input value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Image URL</label>
                        <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="field">
                        <label>Airdrop JSON</label>
                        <textarea value={airdropJson} onChange={(e) => setAirdropJson(e.target.value)} />
                    </div>

                    {error && <p className="error">{error}</p>}

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setStep(1)}>
                            Назад
                        </button>
                        <button
                            className="btn"
                            disabled={loading || !name || !symbol || !wallet}
                            onClick={handleCreateDraft}
                        >
                            {loading ? 'Считаем Merkle…' : 'Собрать Merkle tree'}
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && preview && (
                <div className="card">
                    <h2>3. Деплой jetton ({networkLabel(network)})</h2>
                    <p className="muted">Адрес minter уже вычислен (до деплоя).</p>
                    <p className="muted">Jetton master (raw):</p>
                    <div className="code">{preview.minterAddressRaw}</div>
                    <p>
                        Получателей: <strong>{preview.recipientCount}</strong>
                    </p>
                    <p>
                        Total supply (nano): <strong>{preview.totalSupply}</strong>
                    </p>
                    <p className="muted">Merkle root:</p>
                    <div className="code">{preview.merkleRoot}</div>

                    {error && <p className="error">{error}</p>}

                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setStep(2)}>
                            Назад
                        </button>
                        <button className="btn" disabled={loading || !wallet} onClick={handleDeploy}>
                            {loading ? 'Подтвердите в кошельке…' : `Деплой в ${networkLabel(network)}`}
                        </button>
                    </div>
                </div>
            )}

            {step === 4 && deployed && preview && (
                <div className="card success-box">
                    <h2>Jetton создан в {networkLabel(network)}</h2>
                    <p className="muted">Minter (jetton master):</p>
                    <div className="code">{deployed.minterAddress}</div>
                    <p className="muted" style={{ marginTop: 12 }}>
                        Metadata URI (в контракте):
                    </p>
                    <div className="code">{deployed.metadataUri}</div>
                    <p className="muted" style={{ marginTop: 12 }}>
                        Claim API — подставьте raw owner:
                    </p>
                    <div className="code">{deployed.claimApiUrl}</div>
                    <p className="muted" style={{ marginTop: 16 }}>
                        Все URL используют адрес jetton master, без внутренних id.
                    </p>
                    <p style={{ marginTop: 16 }}>
                        <a href={`/jetton/${preview.minterPath}`}>Страница jetton + compliance →</a>
                    </p>
                </div>
            )}
        </div>
    );
}
