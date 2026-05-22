import { NextRequest, NextResponse } from 'next/server';
import { Address } from '@ton/core';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { buildAirdropArtifacts, parseAirdropJson } from '@/lib/airdrop';
import { resolveAppUrl } from '@/lib/appUrl';
import { resolveMinterConfig } from '@/lib/deploy';
import { masterToPath } from '@/lib/master';

const createSchema = z.object({
    name: z.string().min(1).max(64),
    symbol: z.string().min(1).max(32),
    decimals: z.number().int().min(0).max(18).default(9),
    description: z.string().max(2000).optional().default(''),
    image: z.string().optional().default(''),
    airdropJson: z.string().min(2),
    adminAddress: z.string(),
    network: z.enum(['mainnet', 'testnet']).optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = createSchema.parse(await req.json());
        const admin = Address.parse(body.adminAddress);
        const entries = parseAirdropJson(body.airdropJson);
        const artifacts = buildAirdropArtifacts(entries);

        const { master, metadataUri } = resolveMinterConfig({
            admin,
            merkleRoot: BigInt(artifacts.merkleRootHex),
            baseUrl: resolveAppUrl(req.headers),
        });

        const masterRaw = master.toRawString();

        const existing = await prisma.jetton.findUnique({ where: { minterAddress: masterRaw } });
        if (existing) {
            return NextResponse.json({ error: 'Jetton with this master address already exists' }, { status: 409 });
        }

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
                adminAddress: admin.toString(),
                minterAddress: masterRaw,
                network: body.network,
                status: 'draft',
            },
        });

        return NextResponse.json({
            minterAddress: master.toString({ bounceable: true, urlSafe: true }),
            minterAddressRaw: masterRaw,
            metadataUri,
            merkleRoot: artifacts.merkleRootHex,
            recipientCount: artifacts.recipientCount,
            totalSupply: artifacts.totalSupply,
            apiPath: `/api/jettons/${masterToPath(master)}`,
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
