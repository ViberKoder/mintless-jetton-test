import { Address, beginCell, Cell, Dictionary, DictionaryValue } from '@ton/core';

export type AirdropEntry = {
    owner: string;
    amount: string;
    start_from: number;
    expire_at: number;
};

export type AirdropData = {
    amount: bigint;
    start_from: number;
    expire_at: number;
};

export const airDropValue: DictionaryValue<AirdropData> = {
    serialize: (src, builder) => {
        builder.storeCoins(src.amount);
        builder.storeUint(src.start_from, 48);
        builder.storeUint(src.expire_at, 48);
    },
    parse: (src) => ({
        amount: src.loadCoins(),
        start_from: src.loadUint(48),
        expire_at: src.loadUint(48),
    }),
};

export function buff2bigint(buff: Buffer): bigint {
    return BigInt('0x' + buff.toString('hex'));
}

export function buildAirdropDictionary(entries: AirdropEntry[]): Dictionary<Address, AirdropData> {
    const dict = Dictionary.empty(Dictionary.Keys.Address(), airDropValue);
    for (const entry of entries) {
        dict.set(Address.parse(entry.owner), {
            amount: BigInt(entry.amount),
            start_from: entry.start_from,
            expire_at: entry.expire_at,
        });
    }
    return dict;
}

export function dictionaryToCell(dict: Dictionary<Address, AirdropData>): Cell {
    return beginCell().storeDictDirect(dict).endCell();
}

export function cellToDictionary(cell: Cell): Dictionary<Address, AirdropData> {
    return cell.beginParse().loadDictDirect(Dictionary.Keys.Address(), airDropValue);
}

export function merkleRootFromCell(airdropCell: Cell): bigint {
    return buff2bigint(airdropCell.hash(0));
}

export function totalAirdropSupply(dict: Dictionary<Address, AirdropData>): bigint {
    let total = 0n;
    for (const entry of dict.values()) {
        total += entry.amount;
    }
    return total;
}

export function parseAirdropJson(raw: string): AirdropEntry[] {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Airdrop должен быть непустым JSON-массивом');
    }
    return data.map((row, i) => {
        if (!row.owner || row.amount === undefined) {
            throw new Error(`Строка ${i + 1}: нужны owner и amount`);
        }
        Address.parse(String(row.owner));
        return {
            owner: String(row.owner),
            amount: String(row.amount),
            start_from: Number(row.start_from ?? row.startFrom ?? 0),
            expire_at: Number(row.expire_at ?? row.expireAt ?? row.expired_at ?? 0),
        };
    });
}

export function buildAirdropArtifacts(entries: AirdropEntry[]) {
    const dict = buildAirdropDictionary(entries);
    const cell = dictionaryToCell(dict);
    const merkleRoot = merkleRootFromCell(cell);
    return {
        dict,
        cell,
        merkleRoot,
        merkleRootHex: '0x' + merkleRoot.toString(16),
        bocBase64: cell.toBoc().toString('base64'),
        recipientCount: entries.length,
        totalSupply: totalAirdropSupply(dict).toString(),
    };
}
