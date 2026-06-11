import { NextRequest, NextResponse } from 'next/server';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';
import { jettonMetadataUrl } from '@/lib/appUrl';
import { getToncenterIndexerStatus } from '@/lib/toncenterIndexer';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const network = jetton.network === 'testnet' ? 'testnet' : 'mainnet';
    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);
    const status = await getToncenterIndexerStatus({
        network,
        onChainMaster,
        ourMetadataUri: jettonMetadataUrl(onChainMaster, req.headers),
        adminAddress: jetton.adminAddress,
    });

    return NextResponse.json(status, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
        },
    });
}
