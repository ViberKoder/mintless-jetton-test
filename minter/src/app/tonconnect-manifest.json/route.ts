import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/appUrl';

export async function GET() {
    const url = getAppUrl();
    return NextResponse.json(
        {
            url: 'https://thorough-love-production-f1eb.up.railway.app'
            name: 'Mintless Jetton Minter',
            iconUrl: 'https://ton.org/download/ton_symbol.png',
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=300',
            },
        },
    );
}
