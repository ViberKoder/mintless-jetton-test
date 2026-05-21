import { Address, beginCell, Cell, Dictionary, storeStateInit } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';
import { AirdropData, airDropValue } from './airdrop';
import { findWalletSalt } from './walletSalt';

export type WalletClaimResponse = {
    owner: string;
    jetton_wallet: string;
    custom_payload: string;
    state_init: string;
    compressed_info: {
        amount: string;
        start_from: string;
        expired_at: string;
    };
};

export function buildWalletClaimResponse(params: {
    owner: Address;
    airdrop: AirdropData;
    airdropDict: Dictionary<Address, AirdropData>;
    minter: Address;
    merkleRoot: bigint;
    walletCode: Cell;
}): WalletClaimResponse {
    const { owner, airdrop, airdropDict, minter, merkleRoot, walletCode } = params;

    const receiverProof = airdropDict.generateMerkleProof(owner);
    const claimPayload = JettonWallet.claimPayload(receiverProof);
    const salt = findWalletSalt(owner, minter, merkleRoot, walletCode);

    const jettonWallet = JettonWallet.createFromConfig(
        {
            ownerAddress: owner,
            jettonMasterAddress: minter,
            merkleRoot,
            salt,
        },
        walletCode,
    );

    const stateInitCell = beginCell();
    storeStateInit(jettonWallet.init!)(stateInitCell);

    return {
        owner: owner.toRawString(),
        jetton_wallet: jettonWallet.address.toRawString(),
        custom_payload: claimPayload.toBoc().toString('base64'),
        state_init: stateInitCell.endCell().toBoc().toString('base64'),
        compressed_info: {
            amount: airdrop.amount.toString(),
            start_from: airdrop.start_from.toString(),
            expired_at: airdrop.expire_at.toString(),
        },
    };
}
