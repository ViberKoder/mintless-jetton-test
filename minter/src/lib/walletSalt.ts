import { Address, Cell } from '@ton/core';
import { JettonWallet } from './jetton';

const ITERATION_NUM = 32;

function addressPrefix(address: Address): number {
    const n = BigInt('0x' + address.hash.toString('hex'));
    return Number(n >> 252n);
}

export function findWalletSalt(
    owner: Address,
    minter: Address,
    merkleRoot: bigint,
    walletCode: Cell,
    workchain = 0,
): bigint {
    const ownerPrefix = addressPrefix(owner);
    let minDistance = 0xffff;
    let minSalt = 0n;

    for (let salt = 0; salt <= ITERATION_NUM; salt++) {
        const wallet = JettonWallet.createFromConfig(
            {
                ownerAddress: owner,
                jettonMasterAddress: minter,
                merkleRoot,
                salt: BigInt(salt),
            },
            walletCode,
            workchain,
        );
        const distance = addressPrefix(wallet.address) ^ ownerPrefix;
        if (distance < minDistance) {
            minDistance = distance;
            minSalt = BigInt(salt);
        }
        if (minDistance === 0) break;
    }
    return minSalt;
}
