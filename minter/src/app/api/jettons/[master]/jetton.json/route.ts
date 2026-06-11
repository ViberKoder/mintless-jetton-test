import { NextRequest, NextResponse } from 'next/server';
import { customPayloadApiRoot, mintlessMerkleDumpUrl } from '@/lib/appUrl';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = req.headers;
    const onChainMaster = await resolveOnChainMinterAddress(jetton, headers);

    return NextResponse.json(
        {
            name: jetton.name,
            symbol: jetton.symbol,
            decimals: String(jetton.decimals),
            description: jetton.description || `Mintless jetton ${jetton.symbol}`,
            image: jetton.image || undefined,
            custom_payload_api_uri: customPayloadApiRoot(onChainMaster, headers),
            mintless_merkle_dump_uri: mintlessMerkleDumpUrl(onChainMaster, headers),
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
}
