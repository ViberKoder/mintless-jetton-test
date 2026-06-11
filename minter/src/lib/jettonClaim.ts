import { Address, Cell } from '@ton/core';
import type { Jetton } from '@prisma/client';
import { cellToDictionary } from '@/lib/airdrop';
import { buildWalletClaimResponse } from '@/lib/claim';
import { jettonWalletCodeFromLibrary, loadWalletCodeRaw } from '@/lib/jetton';
import { resolveOnChainMinterAddress } from '@/lib/jettonDb';

export const WALLET_BATCH_MAX = 100;
export const WALLET_BATCH_DEFAULT = 100;
export const WALLET_BATCH_ZERO = '0:0000000000000000000000000000000000000000000000000000000000000000';

export const claimCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
};

export function compareOwnerAddress(a: Address, b: Address): number {
    return a.toRawString().localeCompare(b.toRawString());
}

export function sortOwners(owners: Iterable<Address>): Address[] {
    return [...owners].sort(compareOwnerAddress);
}

export async function loadJettonClaimContext(jetton: Jetton, headers?: Headers) {
    const airdropCell = Cell.fromBoc(Buffer.from(jetton.airdropBoc, 'base64'))[0];
    const airdropDict = cellToDictionary(airdropCell);
    const minter = await resolveOnChainMinterAddress(jetton, headers);
    const merkleRoot = BigInt(jetton.merkleRoot);
    const walletCode = jettonWalletCodeFromLibrary(loadWalletCodeRaw());
    const owners = sortOwners(airdropDict.keys());

    return { airdropDict, minter, merkleRoot, walletCode, owners };
}

export function buildWalletClaimForOwner(
    ctx: Awaited<ReturnType<typeof loadJettonClaimContext>>,
    owner: Address,
) {
    const airdrop = ctx.airdropDict.get(owner);
    if (!airdrop) {
        return null;
    }

    return buildWalletClaimResponse({
        owner,
        airdrop,
        airdropDict: ctx.airdropDict,
        minter: ctx.minter,
        merkleRoot: ctx.merkleRoot,
        walletCode: ctx.walletCode,
    });
}

/** TEP-176 GET /wallets?next_from=&count= */
export function listWalletClaimBatch(
    ctx: Awaited<ReturnType<typeof loadJettonClaimContext>>,
    nextFrom: Address,
    count: number,
) {
    const limit = Math.min(Math.max(count, 1), WALLET_BATCH_MAX);
    const startIdx = ctx.owners.findIndex((owner) => compareOwnerAddress(owner, nextFrom) >= 0);

    if (startIdx === -1) {
        return { wallets: [] as ReturnType<typeof buildWalletClaimResponse>[], next_from: '' };
    }

    const batchOwners = ctx.owners.slice(startIdx, startIdx + limit);
    const wallets = batchOwners
        .map((owner) => buildWalletClaimForOwner(ctx, owner))
        .filter((wallet): wallet is NonNullable<typeof wallet> => wallet !== null);

    const nextIdx = startIdx + limit;
    const next_from = nextIdx < ctx.owners.length ? ctx.owners[nextIdx]!.toRawString() : '';

    return { wallets, next_from };
}

export function parseWalletBatchCount(raw: string | null): number {
    if (!raw) {
        return WALLET_BATCH_DEFAULT;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return WALLET_BATCH_DEFAULT;
    }
    return Math.min(parsed, WALLET_BATCH_MAX);
}

export function parseWalletBatchNextFrom(raw: string | null): Address {
    if (!raw) {
        return Address.parse(WALLET_BATCH_ZERO);
    }
    return Address.parse(raw);
}
