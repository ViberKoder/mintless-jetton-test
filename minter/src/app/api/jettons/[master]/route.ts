import { NextRequest, NextResponse } from 'next/server';
import { Address } from '@ton/core';
import { prisma } from '@/lib/db';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';
import {
    customPayloadApiRoot,
    jettonClaimApiUrl,
    jettonMetadataUrl,
    jettonWalletsBatchUrl,
    mintlessMerkleDumpUrl,
} from '@/lib/appUrl';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const metadataMaster = jetton.minterAddress;
    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);

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
        minterAddress: metadataMaster,
        deployedMinterAddress: onChainMaster.toRawString(),
        network: jetton.network,
        metadataUrl: jettonMetadataUrl(onChainMaster, req.headers),
        customPayloadApiUri: customPayloadApiRoot(onChainMaster, req.headers),
        claimApiUrl: jettonClaimApiUrl(onChainMaster, req.headers),
        walletsBatchUrl: jettonWalletsBatchUrl(onChainMaster, req.headers),
        merkleDumpUrl: mintlessMerkleDumpUrl(onChainMaster, req.headers),
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
            ...(body.deployedMinterAddress
                ? { deployedMinterAddress: Address.parse(String(body.deployedMinterAddress)).toRawString() }
                : {}),
        },
    });
    return NextResponse.json({ ok: true, jetton: updated });
}
