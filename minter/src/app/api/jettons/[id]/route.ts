import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { jettonClaimApiUrl, jettonMetadataUrl } from '@/lib/appUrl';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
        id: jetton.id,
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
        metadataUrl: jettonMetadataUrl(jetton.id),
        claimApiUrl: jettonClaimApiUrl(jetton.id),
        createdAt: jetton.createdAt,
    });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const body = await req.json();
    const jetton = await prisma.jetton.update({
        where: { id: params.id },
        data: {
            status: body.status ?? 'deployed',
            minterAddress: body.minterAddress,
            adminAddress: body.adminAddress,
            network: body.network,
        },
    });
    return NextResponse.json({ ok: true, jetton });
}
