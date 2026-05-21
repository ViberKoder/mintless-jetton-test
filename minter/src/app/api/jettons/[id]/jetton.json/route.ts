import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
    if (!jetton) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(
        {
            name: jetton.name,
            symbol: jetton.symbol,
            decimals: String(jetton.decimals),
            description: jetton.description,
            image: jetton.image || undefined,
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
}
