import { Address, beginCell, Cell, storeStateInit, toNano } from '@ton/core';
import {
    JettonMinter,
    jettonWalletCodeFromLibrary,
    jettonContentToCell,
    loadMinterCode,
    loadWalletCodeRaw,
    Op,
} from './jetton';
import { masterToPath } from './master';

export function metadataUriForMaster(baseUrl: string, master: Address): string {
    return `${baseUrl.replace(/\/$/, '')}/api/jettons/${masterToPath(master)}/jetton.json`;
}

/**
 * Minter address depends on metadata URI and vice versa — iterate until stable.
 */
export function resolveMinterConfig(params: {
    admin: Address;
    merkleRoot: bigint;
    baseUrl: string;
}): { minter: JettonMinter; metadataUri: string; master: Address } {
    const minterCode = loadMinterCode();
    const walletCode = jettonWalletCodeFromLibrary(loadWalletCodeRaw());
    const base = params.baseUrl.replace(/\/$/, '');

    let metadataUri = `${base}/api/jettons/${masterToPath(params.admin)}/jetton.json`;
    let minter = JettonMinter.createFromConfig(
        {
            admin: params.admin,
            wallet_code: walletCode,
            merkle_root: params.merkleRoot,
            jetton_content: jettonContentToCell({ uri: metadataUri }),
        },
        minterCode,
    );

    for (let i = 0; i < 12; i++) {
        const nextUri = metadataUriForMaster(base, minter.address);
        if (nextUri === metadataUri) {
            return { minter, metadataUri, master: minter.address };
        }
        metadataUri = nextUri;
        minter = JettonMinter.createFromConfig(
            {
                admin: params.admin,
                wallet_code: walletCode,
                merkle_root: params.merkleRoot,
                jetton_content: jettonContentToCell({ uri: metadataUri }),
            },
            minterCode,
        );
    }

    return {
        minter,
        metadataUri: metadataUriForMaster(base, minter.address),
        master: minter.address,
    };
}

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

    const deployPayload = beginCell().storeUint(Op.top_up, 32).storeUint(0, 64).endCell();

    return {
        minterAddress: minter.address.toString({ bounceable: true, urlSafe: true }),
        minterAddressRaw: minter.address.toRawString(),
        deployAmount: toNano('1.5').toString(),
        stateInitBoc: stateInit.toBoc().toString('base64'),
        deployPayloadBoc: deployPayload.toBoc().toString('base64'),
    };
}
