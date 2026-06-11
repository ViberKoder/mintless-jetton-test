import { NextRequest, NextResponse } from 'next/server';
import { Address, beginCell, toNano } from '@ton/core';
import { findJettonByMasterParam, resolveOnChainMinterAddress } from '@/lib/jettonDb';
import { jettonMetadataUrl } from '@/lib/appUrl';

const OP_CHANGE_METADATA_URI = 0xcb862902;

function toncenterBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.toncenter.com/api/v3' : 'https://toncenter.com/api/v3';
}

export async function GET(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const network = jetton.network === 'testnet' ? 'testnet' : 'mainnet';
    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);
    const targetUri = jettonMetadataUrl(onChainMaster, req.headers);
    const tcHeaders: Record<string, string> = process.env.TONCENTER_API_KEY
        ? { 'X-API-Key': process.env.TONCENTER_API_KEY }
        : {};
    let currentUri: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const tcRes = await fetch(
            `${toncenterBase(network)}/jetton/masters?address=${onChainMaster.toRawString()}&limit=1`,
            { cache: 'no-store', headers: tcHeaders },
        );
        if (tcRes.ok) {
            const tcData = (await tcRes.json()) as { jetton_masters?: { jetton_content?: { uri?: string } }[] };
            currentUri = tcData.jetton_masters?.[0]?.jetton_content?.uri ?? null;
            if (currentUri) {
                break;
            }
        }
        if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
    }

    const body = beginCell().storeUint(OP_CHANGE_METADATA_URI, 32).storeUint(0, 64).storeStringTail(targetUri).endCell();

    return NextResponse.json(
        {
            onChainMaster: onChainMaster.toRawString(),
            currentUri,
            targetUri,
            needsSync: currentUri !== targetUri,
            message: {
                address: onChainMaster.toString({ bounceable: true, urlSafe: true }),
                amount: toNano('0.05').toString(),
                payload: body.toBoc().toString('base64'),
            },
        },
        {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store',
            },
        },
    );
}

export async function POST(req: NextRequest, { params }: { params: { master: string } }) {
    const jetton = await findJettonByMasterParam(params.master);
    if (!jetton || !jetton.minterAddress) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const adminRaw = body.adminAddress as string | undefined;
    if (!adminRaw) {
        return NextResponse.json({ error: 'adminAddress required' }, { status: 400 });
    }

    const admin = Address.parse(adminRaw);
    if (jetton.adminAddress && !Address.parse(jetton.adminAddress).equals(admin)) {
        return NextResponse.json({ error: 'Only jetton admin can sync metadata' }, { status: 403 });
    }

    const onChainMaster = await resolveOnChainMinterAddress(jetton, req.headers);
    const targetUri = jettonMetadataUrl(onChainMaster, req.headers);
    const payload = beginCell().storeUint(OP_CHANGE_METADATA_URI, 32).storeUint(0, 64).storeStringTail(targetUri).endCell();

    return NextResponse.json({
        targetUri,
        message: {
            address: onChainMaster.toString({ bounceable: true, urlSafe: true }),
            amount: toNano('0.05').toString(),
            payload: payload.toBoc().toString('base64'),
        },
    });
}
