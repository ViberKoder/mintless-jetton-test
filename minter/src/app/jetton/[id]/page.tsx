import Link from 'next/link';
import { prisma } from '@/lib/db';
import { jettonClaimApiUrl, jettonMetadataUrl } from '@/lib/appUrl';

export default async function JettonPage({ params }: { params: { id: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });

    if (!jetton) {
        return (
            <main className="container">
                <p>Jetton не найден</p>
                <Link href="/">На главную</Link>
            </main>
        );
    }

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
                <p className="muted">Merkle root:</p>
                <div className="code">{jetton.merkleRoot}</div>
                {jetton.minterAddress && (
                    <>
                        <p className="muted" style={{ marginTop: 12 }}>
                            Minter:
                        </p>
                        <div className="code">{jetton.minterAddress}</div>
                    </>
                )}
                <p className="muted" style={{ marginTop: 12 }}>
                    Metadata:
                </p>
                <div className="code">{jettonMetadataUrl(jetton.id)}</div>
                <p className="muted" style={{ marginTop: 12 }}>
                    Claim API:
                </p>
                <div className="code">{jettonClaimApiUrl(jetton.id)}</div>
            </div>
        </main>
    );
}
