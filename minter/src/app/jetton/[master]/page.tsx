import Link from 'next/link';
import { headers } from 'next/headers';
import { findJettonByMasterParam } from '@/lib/jettonDb';
import { jettonClaimApiUrl, jettonMetadataUrl, mintlessMerkleDumpUrl } from '@/lib/appUrl';

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

    const master = jetton.minterAddress;

    return (
        <main className="container">
            <Link href="/">← Назад</Link>
            <h1>
                {jetton.name} ({jetton.symbol})
            </h1>
            <div className="card">
                <p>
                    Статус: <strong>{jetton.status}</strong>
                </p>
                <p>Получателей: {jetton.recipientCount}</p>
                <p className="muted">Jetton master (raw):</p>
                <div className="code">{master}</div>
                <p className="muted">Merkle root:</p>
                <div className="code">{jetton.merkleRoot}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Metadata:
                </p>
                <div className="code">{jettonMetadataUrl(master, reqHeaders)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Claim API:
                </p>
                <div className="code">{jettonClaimApiUrl(master, reqHeaders)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Merkle dump:
                </p>
                <div className="code">{mintlessMerkleDumpUrl(master, reqHeaders)}</div>
            </div>
        </main>
    );
}
