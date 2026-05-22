import { NextRequest, NextResponse } from 'next/server';
import { findJettonByMasterParam } from '@/lib/jettonDb';

export async function GET(_req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const boc = Buffer.from(jetton.airdropBoc, 'base64');

    return new NextResponse(boc, {
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="airdrop.boc"`,
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
