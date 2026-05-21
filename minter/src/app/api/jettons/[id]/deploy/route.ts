import { NextRequest, NextResponse } from 'next/server';
import { Address } from '@ton/core';
import { prisma } from '@/lib/db';
import { buildMinterDeploy } from '@/lib/deploy';
import { jettonMetadataUrl } from '@/lib/appUrl';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
        if (!jetton) {
            return NextResponse.json({ error: 'Jetton not found' }, { status: 404 });
        }

        const body = await req.json();
        const adminRaw = body.adminAddress as string | undefined;
        if (!adminRaw) {
            return NextResponse.json({ error: 'adminAddress required (from TON Connect wallet)' }, { status: 400 });
        }

        const admin = Address.parse(adminRaw);
        const merkleRoot = BigInt(jetton.merkleRoot);
        const metadataUri = jettonMetadataUrl(jetton.id, req.headers);
        const deploy = buildMinterDeploy({ admin, merkleRoot, metadataUri });

        await prisma.jetton.update({
            where: { id: jetton.id },
            data: { adminAddress: admin.toString(), status: 'pending_deploy' },
        });

        return NextResponse.json({
            jettonId: jetton.id,
            metadataUri,
            merkleRoot: jetton.merkleRoot,
            ...deploy,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Deploy build failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
