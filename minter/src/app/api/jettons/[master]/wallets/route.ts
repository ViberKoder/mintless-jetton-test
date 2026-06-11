import { NextRequest, NextResponse } from 'next/server';
import { findJettonByMasterParam } from '@/lib/jettonDb';
import {
    claimCorsHeaders,
    listWalletClaimBatch,
    loadJettonClaimContext,
    parseWalletBatchCount,
    parseWalletBatchNextFrom,
} from '@/lib/jettonClaim';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Jetton not deployed' }, { status: 404, headers: claimCorsHeaders });
    }

    let nextFrom;
    try {
        nextFrom = parseWalletBatchNextFrom(req.nextUrl.searchParams.get('next_from'));
    } catch {
        return NextResponse.json(
            { error: 'Invalid next_from (use raw 0:...)' },
            { status: 400, headers: claimCorsHeaders },
        );
    }

    const count = parseWalletBatchCount(req.nextUrl.searchParams.get('count'));
    const ctx = await loadJettonClaimContext(jetton, req.headers);
    const body = listWalletClaimBatch(ctx, nextFrom, count);

    return NextResponse.json(body, { headers: claimCorsHeaders });
}
