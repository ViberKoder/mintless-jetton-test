import { NextRequest, NextResponse } from 'next/server';
import { resolveAppUrl } from '@/lib/appUrl';

export async function GET(request: NextRequest) {
    const url = resolveAppUrl(request.headers);
    return NextResponse.json(
        {
            url,
            name: 'Mintless Jetton Minter',
            iconUrl: 'https://ton.org/download/ton_symbol.png',
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        },
    );
}
