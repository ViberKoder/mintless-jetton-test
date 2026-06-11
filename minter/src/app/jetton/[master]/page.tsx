import Link from 'next/link';
import { headers } from 'next/headers';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';
import { jettonClaimApiUrl, jettonMetadataUrl, mintlessMerkleDumpUrl } from '@/lib/appUrl';
import { ClaimJettonPanel } from '@/components/ClaimJettonPanel';
import { masterToPath } from '@/lib/master';

export default async function JettonPage({ params }: { params: { master: string } }) {
    const reqHeaders = await headers();
    const jetton = await findJettonByMasterParam(params.master);

    if (!jetton || !jetton.minterAddress) {
        return (
            <main className="container">
                <p>Jetton не найден</p>
                <Link href="/">На главную</Link>
            </main>
        );
    }

    const metadataMaster = jetton.minterAddress;
    const onChainMaster = await resolveOnChainMinterAddress(jetton, reqHeaders);
    const onChainPath = masterToPath(onChainMaster);

    return (
        <main className="container">
            <Link href="/">← Назад</Link>
            <h1>
                {jetton.name} ({jetton.symbol})
            </h1>

            <ClaimJettonPanel
                masterParam={params.master}
                jettonName={jetton.name}
                jettonSymbol={jetton.symbol}
                decimals={jetton.decimals}
            />

            <div className="card">
                <h2>Почему jetton не виден в кошельке?</h2>
                <p className="muted">
                    Mintless jetton — это airdrop до первого claim. Пока получатель не заклеймил токен,
                    on-chain баланс равен 0, и обычный список jetton в Tonkeeper / MyTonWallet его не
                    показывает. Кошельки могут отображать unclaimed баланс только если проиндексировали{' '}
                    <code>mintless_merkle_dump_uri</code> — для кастомных jetton это не обязательно и
                    часто платная услуга.
                </p>
                <p className="muted">
                    После claim через кнопку выше jetton появится как обычный токен. Альтернатива: попросить
                    Tonkeeper проиндексировать merkle dump по master-адресу{' '}
                    <span className="code">{onChainMaster.toRawString()}</span>.
                </p>
            </div>

            <div className="card">
                <p>
                    Статус: <strong>{jetton.status}</strong>
                </p>
                <p>Получателей: {jetton.recipientCount}</p>
                <p className="muted">On-chain jetton master (raw):</p>
                <div className="code">{onChainMaster.toRawString()}</div>
                {onChainMaster.toRawString() !== metadataMaster && (
                    <>
                        <p className="muted" style={{ marginTop: 12 }}>
                            Metadata API path (в контракте):
                        </p>
                        <div className="code">{metadataMaster}</div>
                    </>
                )}
                <p className="muted">Merkle root:</p>
                <div className="code">{jetton.merkleRoot}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Metadata:
                </p>
                <div className="code">{jettonMetadataUrl(onChainMaster, reqHeaders)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Claim API:
                </p>
                <div className="code">{jettonClaimApiUrl(onChainMaster, reqHeaders)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Merkle dump:
                </p>
                <div className="code">{mintlessMerkleDumpUrl(onChainMaster, reqHeaders)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Страница claim:
                </p>
                <div className="code">/jetton/{onChainPath}</div>
            </div>
        </main>
    );
}
