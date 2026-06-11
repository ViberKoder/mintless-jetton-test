import { NextRequest, NextResponse } from 'next/server';
import { Address, toNano } from '@ton/core';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';
import { jettonMetadataUrl } from '@/lib/appUrl';
import {
    buildChangeMetadataPayload,
    bumpMetadataUri,
    getToncenterIndexerStatus,
} from '@/lib/toncenterIndexer';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const network = jetton.network === 'testnet' ? 'testnet' : 'mainnet';
    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);
    const baseUri = jettonMetadataUrl(onChainMaster, req.headers);
    const indexer = await getToncenterIndexerStatus({
        network,
        onChainMaster,
        ourMetadataUri: baseUri,
        adminAddress: jetton.adminAddress,
    });
    const currentUri = indexer.onChainMetadataUri;
    const targetUri = baseUri;
    const needsSync = currentUri !== targetUri;
    const needsBump = !needsSync && indexer.recommendedAction === 'bump_metadata_uri';

    return NextResponse.json(
        {
            onChainMaster: onChainMaster.toRawString(),
            currentUri,
            targetUri,
            needsSync,
            needsBump,
            bumpTargetUri: indexer.bumpTargetUri,
            toncenterCacheStale: indexer.cacheStale,
            mintlessInfoIndexed: indexer.mintlessInfoIndexed,
            message: {
                address: onChainMaster.toString({ bounceable: true, urlSafe: true }),
                amount: toNano('0.05').toString(),
                payload: buildChangeMetadataPayload(targetUri),
            },
            bumpMessage: indexer.bumpTargetUri
                ? {
                      address: onChainMaster.toString({ bounceable: true, urlSafe: true }),
                      amount: toNano('0.05').toString(),
                      payload: buildChangeMetadataPayload(indexer.bumpTargetUri),
                  }
                : null,
        },
        {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store',
            },
        },
    );
}

export async function POST(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const adminRaw = body.adminAddress as string | undefined;
    if (!adminRaw) {
        return NextResponse.json({ error: 'adminAddress required' }, { status: 400 });
    }

    const admin = Address.parse(adminRaw);
    if (jetton.adminAddress && !Address.parse(jetton.adminAddress).equals(admin)) {
        return NextResponse.json({ error: 'Only jetton admin can sync metadata' }, { status: 403 });
    }

    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);
    const baseUri = jettonMetadataUrl(onChainMaster, req.headers);
    const action = (body.action as string | undefined) ?? 'sync';
    const targetUri =
        action === 'bump'
            ? bumpMetadataUri(body.metadataUri ? String(body.metadataUri) : baseUri)
            : baseUri;

    return NextResponse.json({
        targetUri,
        action,
        message: {
            address: onChainMaster.toString({ bounceable: true, urlSafe: true }),
            amount: toNano('0.05').toString(),
            payload: buildChangeMetadataPayload(targetUri),
        },
    });
}
