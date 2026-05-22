import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { customPayloadApiRoot, mintlessMerkleDumpUrl } from '@/lib/appUrl';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const headers = req.headers;

    return NextResponse.json(
        {
            name: jetton.name,
            symbol: jetton.symbol,
            decimals: String(jetton.decimals),
            description: jetton.description,
            image: jetton.image || undefined,
            custom_payload_api_uri: customPayloadApiRoot(jetton.id, headers),
            mintless_merkle_dump_uri: mintlessMerkleDumpUrl(jetton.id, headers),
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
}
