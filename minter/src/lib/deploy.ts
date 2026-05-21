import { Address, beginCell, Cell, storeStateInit, toNano } from '@ton/core';
import {
    JettonMinter,
    jettonWalletCodeFromLibrary,
    jettonContentToCell,
    loadMinterCode,
    loadWalletCodeRaw,
} from './jetton';

export function buildMinterDeploy(params: {
    admin: Address;
    merkleRoot: bigint;
    metadataUri: string;
}) {
    const minterCode = loadMinterCode();
    const walletCode = jettonWalletCodeFromLibrary(loadWalletCodeRaw());

    const minter = JettonMinter.createFromConfig(
        {
            admin: params.admin,
            wallet_code: walletCode,
            merkle_root: params.merkleRoot,
            jetton_content: jettonContentToCell({ uri: params.metadataUri }),
        },
        minterCode,
    );

    if (!minter.init) {
        throw new Error('Minter init missing');
    }

    const stateInitB = beginCell();
    storeStateInit(minter.init)(stateInitB);
    const stateInit = stateInitB.endCell();

    return {
        minterAddress: minter.address.toString({ bounceable: true, urlSafe: true }),
        minterAddressRaw: minter.address.toRawString(),
        deployAmount: toNano('1.5').toString(),
        stateInitBoc: stateInit.toBoc().toString('base64'),
    };
}
