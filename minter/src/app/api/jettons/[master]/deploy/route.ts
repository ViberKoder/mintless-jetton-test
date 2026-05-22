import { NextRequest, NextResponse } from 'next/server';
import { Address } from '@ton/core';
import { prisma } from '@/lib/db';
import { buildMinterDeploy } from '@/lib/deploy';
import { jettonMetadataUrl } from '@/lib/appUrl';
import { findJettonByMasterParam } from '@/lib/jettonDb';

export async function POST(req: NextRequest, { params }: { params: { master: string } }) {
    try {
        const jetton = await findJettonByMasterParam(params.master);
        if (!jetton || !jetton.minterAddress) {
            return NextResponse.json({ error: 'Jetton not found' }, { status: 404 });
        }

        const body = await req.json();
        const adminRaw = body.adminAddress as string | undefined;
        if (!adminRaw) {
            return NextResponse.json({ error: 'adminAddress required (from TON Connect wallet)' }, { status: 400 });
        }

        const admin = Address.parse(adminRaw);
        const merkleRoot = BigInt(jetton.merkleRoot);
        const metadataUri = jettonMetadataUrl(jetton.minterAddress, req.headers);
        const deploy = buildMinterDeploy({ admin, merkleRoot, metadataUri });

        await prisma.jetton.update({
            where: { id: jetton.id },
            data: { adminAddress: admin.toString(), status: 'pending_deploy' },
        });

        return NextResponse.json({
            metadataUri,
            merkleRoot: jetton.merkleRoot,
            ...deploy,
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Deploy build failed';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
