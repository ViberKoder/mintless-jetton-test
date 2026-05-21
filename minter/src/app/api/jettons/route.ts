import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { buildAirdropArtifacts, parseAirdropJson } from '@/lib/airdrop';

const createSchema = z.object({
    name: z.string().min(1).max(64),
    symbol: z.string().min(1).max(32),
    decimals: z.number().int().min(0).max(18).default(9),
    description: z.string().max(2000).optional().default(''),
    image: z.string().optional().default(''),
    airdropJson: z.string().min(2),
    adminAddress: z.string().optional(),
    network: z.enum(['mainnet', 'testnet']).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = createSchema.parse(await req.json());
        const entries = parseAirdropJson(body.airdropJson);
        const artifacts = buildAirdropArtifacts(entries);

        const jetton = await prisma.jetton.create({
            data: {
                name: body.name,
                symbol: body.symbol,
                decimals: body.decimals,
                description: body.description ?? '',
                image: body.image ?? '',
                merkleRoot: artifacts.merkleRootHex,
                airdropBoc: artifacts.bocBase64,
                recipientCount: artifacts.recipientCount,
                totalSupply: artifacts.totalSupply,
                adminAddress: body.adminAddress,
                network: body.network,
                status: 'draft',
            },
        });

        return NextResponse.json({
            id: jetton.id,
            merkleRoot: artifacts.merkleRootHex,
            recipientCount: artifacts.recipientCount,
            totalSupply: artifacts.totalSupply,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid request';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

export async function GET() {
    const jettons = await prisma.jetton.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true,
            name: true,
            symbol: true,
            status: true,
            minterAddress: true,
            recipientCount: true,
            createdAt: true,
        },
    });
    return NextResponse.json({ jettons });
}
