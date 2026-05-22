import { NextRequest, NextResponse } from 'next/server';
import { findJettonByMasterParam } from '@/lib/jettonDb';

export async function GET(_req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(
        {
            total_wallets: jetton.recipientCount,
            master_address: jetton.minterAddress,
        },
        {
            headers: { 'Access-Control-Allow-Origin': '*' },
        },
    );
}
