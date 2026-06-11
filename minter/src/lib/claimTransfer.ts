import { Address, beginCell, Cell } from '@ton/core';

const Op = {
    transfer: 0xf8a7ea5,
};

/** TEP-74 transfer body with mintless claim custom_payload (TEP-176). */
export function buildClaimTransferPayload(params: {
    jettonAmount: bigint;
    destination: Address;
    responseDestination: Address;
    customPayload: Cell;
    forwardTonAmount?: bigint;
}): Cell {
    return beginCell()
        .storeUint(Op.transfer, 32)
        .storeUint(0, 64)
        .storeCoins(params.jettonAmount)
        .storeAddress(params.destination)
        .storeAddress(params.responseDestination)
        .storeMaybeRef(params.customPayload)
        .storeCoins(params.forwardTonAmount ?? 1n)
        .storeBit(false)
        .endCell();
}

export type ClaimApiResponse = {
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

export function isClaimApiResponse(value: unknown): value is ClaimApiResponse {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const v = value as Record<string, unknown>;
    return (
        typeof v.jetton_wallet === 'string' &&
        typeof v.custom_payload === 'string' &&
        typeof v.state_init === 'string' &&
        !!v.compressed_info &&
        typeof (v.compressed_info as Record<string, unknown>).amount === 'string'
    );
}
