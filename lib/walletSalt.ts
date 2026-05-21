import { Address, Cell } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';

const ITERATION_NUM = 32;

function addressPrefix(address: Address): number {
    const n = BigInt('0x' + address.hash.toString('hex'));
    return Number(n >> 252n);
}

/** Mirrors on-chain `calculate_jetton_wallet_properties_cheap` salt search. */
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
        const walletPrefix = addressPrefix(wallet.address);
        const distance = walletPrefix ^ ownerPrefix;
        if (distance < minDistance) {
            minDistance = distance;
            minSalt = BigInt(salt);
        }
        if (minDistance === 0) {
            break;
        }
    }

    return minSalt;
}
