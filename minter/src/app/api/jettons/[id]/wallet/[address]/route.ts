import { NextRequest, NextResponse } from 'next/server';
import { Address, Cell } from '@ton/core';
import { prisma } from '@/lib/db';
import { cellToDictionary } from '@/lib/airdrop';
import { buildWalletClaimResponse } from '@/lib/claim';
import { jettonWalletCodeFromLibrary, loadWalletCodeRaw } from '@/lib/jetton';

export async function GET(_req: NextRequest, { params }: { params: { id: string; address: string } }) {
    const jetton = await prisma.jetton.findUnique({ where: { id: params.id } });
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Jetton not deployed' }, { status: 404 });
    }

    let owner: Address;
    try {
        owner = Address.parse(params.address);
    } catch {
        return NextResponse.json({ error: 'Invalid owner address (use raw 0:...)' }, { status: 400 });
    }

    const airdropCell = Cell.fromBoc(Buffer.from(jetton.airdropBoc, 'base64'))[0];
    const airdropDict = cellToDictionary(airdropCell);
    const airdrop = airdropDict.get(owner);
    if (!airdrop) {
        return NextResponse.json({});
    }

    const walletCode = jettonWalletCodeFromLibrary(loadWalletCodeRaw());
    const minter = Address.parse(jetton.minterAddress);
    const merkleRoot = BigInt(jetton.merkleRoot);

    const body = buildWalletClaimResponse({
        owner,
        airdrop,
        airdropDict,
        minter,
        merkleRoot,
        walletCode,
    });

    return NextResponse.json(body, {
        headers: { 'Access-Control-Allow-Origin': '*' },
    });
}
