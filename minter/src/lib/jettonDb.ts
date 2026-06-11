import { Address } from '@ton/core';
import type { Jetton } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildMinterDeploy } from '@/lib/deploy';
import { jettonMetadataUrl } from '@/lib/appUrl';
import { masterFromPath } from '@/lib/master';

export function computeDeployedMinterAddress(
    jetton: Pick<Jetton, 'adminAddress' | 'merkleRoot' | 'minterAddress'>,
    headers?: Headers,
): Address {
    if (!jetton.adminAddress || !jetton.minterAddress) {
        throw new Error('Jetton missing admin or metadata minter address');
    }
    const deploy = buildMinterDeploy({
        admin: Address.parse(jetton.adminAddress),
        merkleRoot: BigInt(jetton.merkleRoot),
        metadataUri: jettonMetadataUrl(jetton.minterAddress, headers),
    });
    return Address.parse(deploy.minterAddressRaw);
}

/** On-chain master used for wallet address / claim math */
export async function resolveOnChainMinterAddress(jetton: Jetton, headers?: Headers): Promise<Address> {
    if (jetton.deployedMinterAddress) {
        return Address.parse(jetton.deployedMinterAddress);
    }
    const onChain = computeDeployedMinterAddress(jetton, headers);
    await prisma.jetton.update({
        where: { id: jetton.id },
        data: { deployedMinterAddress: onChain.toRawString() },
    });
    return onChain;
}

export async function findJettonByMasterParam(masterParam: string) {
    const master = masterFromPath(masterParam);
    const raw = master.toRawString();
    const friendly = master.toString({ bounceable: true, urlSafe: true });

    const direct = await prisma.jetton.findFirst({
        where: {
            OR: [
                { minterAddress: raw },
                { minterAddress: friendly },
                { deployedMinterAddress: raw },
                { deployedMinterAddress: friendly },
            ],
        },
    });
    if (direct) {
        return direct;
    }

    // Fallback: match by computed on-chain address (fixes DB before first sync)
    const candidates = await prisma.jetton.findMany({
        where: { deployedMinterAddress: null, minterAddress: { not: null }, adminAddress: { not: null } },
        take: 100,
    });
    for (const jetton of candidates) {
        try {
            if (computeDeployedMinterAddress(jetton).equals(master)) {
                return prisma.jetton.update({
                    where: { id: jetton.id },
                    data: { deployedMinterAddress: raw },
                });
            }
        } catch {
            // skip invalid rows
        }
    }

    return null;
}
