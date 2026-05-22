import { NextRequest, NextResponse } from 'next/server';
import { customPayloadApiRoot, mintlessMerkleDumpUrl } from '@/lib/appUrl';
import { findJettonByMasterParam } from '@/lib/jettonDb';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const master = jetton.minterAddress;
    const headers = req.headers;

    return NextResponse.json(
        {
            name: jetton.name,
            symbol: jetton.symbol,
            decimals: String(jetton.decimals),
            description: jetton.description,
            image: jetton.image || undefined,
            custom_payload_api_uri: customPayloadApiRoot(master, headers),
            mintless_merkle_dump_uri: mintlessMerkleDumpUrl(master, headers),
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
}
