import { NextRequest, NextResponse } from 'next/server';
import { findJettonByMasterParam } from '@/lib/jettonDb';
import { runCompliance } from '@/lib/compliance';

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const report = await runCompliance(jetton, req.headers);

    return NextResponse.json(report, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
        },
    });
}
