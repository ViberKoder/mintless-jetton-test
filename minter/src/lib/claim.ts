import { Address, beginCell, Cell, Dictionary, storeStateInit } from '@ton/core';
import { JettonWallet } from './jetton';
import { AirdropData, airDropValue } from './airdrop';
import { findWalletSalt } from './walletSalt';

export function buildWalletClaimResponse(params: {
    owner: Address;
    airdrop: AirdropData;
    airdropDict: Dictionary<Address, AirdropData>;
    minter: Address;
    merkleRoot: bigint;
    walletCode: Cell;
}) {
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
