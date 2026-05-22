import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(
        {
            total_wallets: jetton.recipientCount,
            master_address: jetton.minterAddress ?? '',
        },
        {
            headers: { 'Access-Control-Allow-Origin': '*' },
        },
    );
}
