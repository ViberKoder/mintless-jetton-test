import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { findJettonByMasterParam } from '@/lib/jettonDb';
import { customPayloadApiRoot, jettonClaimApiUrl, jettonMetadataUrl, mintlessMerkleDumpUrl } from '@/lib/appUrl';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const master = jetton.minterAddress;

    return NextResponse.json({
        status: jetton.status,
        name: jetton.name,
        symbol: jetton.symbol,
        decimals: jetton.decimals,
        description: jetton.description,
        image: jetton.image,
        merkleRoot: jetton.merkleRoot,
        recipientCount: jetton.recipientCount,
        totalSupply: jetton.totalSupply,
        adminAddress: jetton.adminAddress,
        minterAddress: jetton.minterAddress,
        network: jetton.network,
        metadataUrl: jettonMetadataUrl(master, req.headers),
        customPayloadApiUri: customPayloadApiRoot(master, req.headers),
        claimApiUrl: jettonClaimApiUrl(master, req.headers),
        merkleDumpUrl: mintlessMerkleDumpUrl(master, req.headers),
        createdAt: jetton.createdAt,
    });
}

export async function PATCH(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await prisma.jetton.update({
        where: { id: jetton.id },
        data: {
            status: body.status ?? 'deployed',
            adminAddress: body.adminAddress,
            network: body.network,
        },
    });
    return NextResponse.json({ ok: true, jetton: updated });
}
