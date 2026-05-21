import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    Slice,
} from '@ton/core';
import minterCompiled from '@/contracts/JettonMinter.compiled.json';
import walletCompiled from '@/contracts/JettonWallet.compiled.json';

export const Op = { airdrop_claim: 0x0df602d6, transfer: 0xf8a7ea5 };

export type JettonMinterContent = { uri: string };

export type JettonMinterConfig = {
    admin: Address;
    wallet_code: Cell;
    jetton_content: Cell | JettonMinterContent;
    merkle_root: bigint;
};

export function jettonContentToCell(content: JettonMinterContent): Cell {
    return beginCell().storeStringRefTail(content.uri).endCell();
}

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    const content =
        config.jetton_content instanceof Cell ? config.jetton_content : jettonContentToCell(config.jetton_content);
    return beginCell()
        .storeCoins(0)
        .storeAddress(config.admin)
        .storeAddress(null)
        .storeUint(config.merkle_root, 256)
        .storeRef(config.wallet_code)
        .storeRef(content)
        .endCell();
}

export function jettonWalletCodeFromLibrary(jettonWalletCodeRaw: Cell): Cell {
    const libraryReferenceCell = beginCell().storeUint(2, 8).storeBuffer(jettonWalletCodeRaw.hash()).endCell();
    return new Cell({ exotic: true, bits: libraryReferenceCell.bits, refs: libraryReferenceCell.refs });
}

export function loadMinterCode(): Cell {
    return Cell.fromBoc(Buffer.from(minterCompiled.hex, 'hex'))[0];
}

export function loadWalletCodeRaw(): Cell {
    return Cell.fromBoc(Buffer.from(walletCompiled.hex, 'hex'))[0];
}

export class JettonMinter implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }
}

export type JettonWalletConfig = {
    ownerAddress: Address;
    jettonMasterAddress: Address;
    merkleRoot: bigint;
    salt: bigint;
};

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell()
        .storeUint(0, 4)
        .storeCoins(0)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.jettonMasterAddress)
        .storeUint(config.merkleRoot, 256)
        .storeUint(config.salt, 10)
        .endCell();
}

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    static claimPayload(proof: Cell): Cell {
        return beginCell().storeUint(Op.airdrop_claim, 32).storeRef(proof).endCell();
    }
}

export function endParse(slice: Slice) {
    if (slice.remainingBits > 0 || slice.remainingRefs > 0) {
        throw new Error('remaining bits in data');
    }
}
