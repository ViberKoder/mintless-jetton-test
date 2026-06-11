import { Address, beginCell } from '@ton/core';

export type ToncenterIndexerStatus = {
    network: 'mainnet' | 'testnet';
    onChainMaster: string;
    onChainMetadataUri: string | null;
    ourMetadataUri: string;
    toncenterCached: {
        metadataUri: string | null;
        customPayloadApiUri: string | null;
        mintlessMerkleDumpUri: string | null;
        isIndexed: boolean;
    };
    cacheStale: boolean;
    mintlessInfoIndexed: boolean;
    mintlessInfoSample: Record<string, unknown> | null;
    walletsIndexed: number;
    tonapiWorks: boolean;
    toncenterWorks: boolean;
    recommendedAction: 'wait' | 'bump_metadata_uri' | 'request_toncenter_indexing' | 'ready';
    bumpTargetUri: string | null;
    supportMessage: string;
};

function toncenterBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.toncenter.com/api/v3' : 'https://toncenter.com/api/v3';
}

function toncenterHeaders(): Record<string, string> {
    const key = process.env.TONCENTER_API_KEY;
    return key ? { 'X-API-Key': key } : {};
}

function includesMaster(value: string | null | undefined, master: Address): boolean {
    if (!value) {
        return false;
    }
    const raw = master.toRawString().toLowerCase();
    const hex = raw.split(':')[1] ?? '';
    const encoded = encodeURIComponent(raw).toLowerCase();
    const v = value.toLowerCase();
    return v.includes(raw) || v.includes(encoded) || v.includes(hex);
}

function metadataRowForAddress(
    metadata: Record<string, unknown> | undefined,
    masterRaw: string,
): Record<string, unknown> | null {
    if (!metadata) {
        return null;
    }
    const key = Object.keys(metadata).find((k) => k.toLowerCase() === masterRaw.toLowerCase());
    return key ? (metadata[key] as Record<string, unknown>) : null;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch(url, { cache: 'no-store', ...init });
        if (!res.ok) {
            return null;
        }
        return (await res.json()) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function bumpMetadataUri(uri: string): string {
    const url = new URL(uri);
    const current = Number.parseInt(url.searchParams.get('v') ?? '1', 10);
    url.searchParams.set('v', String(Number.isFinite(current) ? current + 1 : 2));
    return url.toString();
}

export async function getToncenterIndexerStatus(params: {
    network: 'mainnet' | 'testnet';
    onChainMaster: Address;
    ourMetadataUri: string;
    adminAddress?: string | null;
}): Promise<ToncenterIndexerStatus> {
    const { network, onChainMaster, ourMetadataUri, adminAddress } = params;
    const masterRaw = onChainMaster.toRawString();
    const friendly = onChainMaster.toString({ bounceable: true, urlSafe: true });
    const headers = toncenterHeaders();

    const tcMaster = await fetchJson(`${toncenterBase(network)}/jetton/masters?address=${masterRaw}&limit=1`, {
        headers,
    });
    const masterRow = ((tcMaster?.jetton_masters as unknown[]) ?? [])[0] as
        | { jetton_content?: { uri?: string } }
        | undefined;
    const onChainMetadataUri = masterRow?.jetton_content?.uri ?? null;

    let metaRow = metadataRowForAddress(tcMaster?.metadata as Record<string, unknown> | undefined, masterRaw);
    if (!metaRow) {
        const tcMeta = await fetchJson(`${toncenterBase(network)}/metadata?address=${masterRaw}`, { headers });
        metaRow = tcMeta ? (Object.values(tcMeta)[0] as Record<string, unknown>) : null;
    }

    const token = ((metaRow?.token_info as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const extra = (token?.extra as Record<string, string>) ?? {};

    const toncenterCached = {
        metadataUri: extra.uri ?? null,
        customPayloadApiUri: extra.custom_payload_api_uri ?? null,
        mintlessMerkleDumpUri: extra.mintless_merkle_dump_uri ?? null,
        isIndexed: metaRow?.is_indexed === true,
    };

    const cacheStale =
        !includesMaster(toncenterCached.customPayloadApiUri, onChainMaster) ||
        !includesMaster(toncenterCached.mintlessMerkleDumpUri, onChainMaster) ||
        !includesMaster(toncenterCached.metadataUri, onChainMaster);

    let mintlessInfoSample: Record<string, unknown> | null = null;
    let walletsIndexed = 0;
    if (adminAddress) {
        const tcWallets = await fetchJson(
            `${toncenterBase(network)}/jetton/wallets?owner_address=${Address.parse(adminAddress).toRawString()}&jetton_address=${masterRaw}&exclude_zero_balance=false`,
            { headers },
        );
        const rows = (tcWallets?.jetton_wallets as Record<string, unknown>[]) ?? [];
        walletsIndexed = rows.length;
        mintlessInfoSample = (rows[0]?.mintless_info as Record<string, unknown>) ?? null;
    }

    const allWallets = await fetchJson(
        `${toncenterBase(network)}/jetton/wallets?jetton_address=${masterRaw}&limit=5&exclude_zero_balance=false`,
        { headers },
    );
    const totalMintlessWallets = ((allWallets?.jetton_wallets as Record<string, unknown>[]) ?? []).filter(
        (row) => row.mintless_info,
    ).length;

    const taJetton = await fetchJson(`https://${network === 'testnet' ? 'testnet.' : ''}tonapi.io/v2/jettons/${friendly}`);
    const taMeta = (taJetton?.metadata as Record<string, string>) ?? {};
    const tonapiWorks = includesMaster(taMeta.custom_payload_api_uri, onChainMaster);

    const mintlessInfoIndexed = !!mintlessInfoSample?.amount || totalMintlessWallets > 0;
    const toncenterWorks = mintlessInfoIndexed && !cacheStale;

    const onChainUriSynced = includesMaster(onChainMetadataUri, onChainMaster);
    const bumpAlreadyTried = Boolean(onChainMetadataUri?.includes('?v='));

    let recommendedAction: ToncenterIndexerStatus['recommendedAction'] = 'ready';
    let bumpTargetUri: string | null = null;

    if (!mintlessInfoIndexed) {
        if (cacheStale && onChainUriSynced && bumpAlreadyTried) {
            // On-chain URI is correct (incl. bump) but Toncenter metadata cache did not refresh.
            recommendedAction = 'request_toncenter_indexing';
        } else if (cacheStale && !onChainUriSynced) {
            recommendedAction = 'bump_metadata_uri';
            bumpTargetUri = bumpMetadataUri(ourMetadataUri);
        } else if (cacheStale) {
            recommendedAction = bumpAlreadyTried ? 'request_toncenter_indexing' : 'bump_metadata_uri';
            bumpTargetUri = bumpAlreadyTried ? null : bumpMetadataUri(onChainMetadataUri ?? ourMetadataUri);
        } else {
            recommendedAction = 'request_toncenter_indexing';
        }
    } else if (cacheStale) {
        recommendedAction = 'wait';
    }

    const liveDump = ourMetadataUri.replace(/\/jetton\.json.*$/, '/merkle-dump');
    const liveApi = ourMetadataUri.replace(/\/jetton\.json.*$/, '');
    const supportMessage = [
        'Mintless jetton indexing request (Toncenter / Tonscan / MyTonWallet)',
        '',
        `Master (raw): ${masterRaw}`,
        `Master (friendly): ${friendly}`,
        '',
        'On-chain metadata URI (current):',
        onChainMetadataUri ?? ourMetadataUri,
        '',
        'Live jetton.json (correct, please re-index):',
        ourMetadataUri,
        `  custom_payload_api_uri: ${liveApi}`,
        `  mintless_merkle_dump_uri: ${liveDump}`,
        '',
        'Toncenter metadata CACHE (stale — still old path):',
        `  extra.uri: ${toncenterCached.metadataUri ?? 'n/a'}`,
        `  extra.custom_payload_api_uri: ${toncenterCached.customPayloadApiUri ?? 'n/a'}`,
        `  extra.mintless_merkle_dump_uri: ${toncenterCached.mintlessMerkleDumpUri ?? 'n/a'}`,
        '',
        'Verification:',
        `  GET ${liveDump} → BOC hash 6369ec5ced9f94c8414f9bbfe374d38c7507f1983671799d91e00a4649369d3f`,
        `  get_mintless_airdrop_hashmap_root on master → same root`,
        `  GET ${liveApi}/wallets?next_from=0:000...&count=100 → TEP-176 batch`,
        '',
        'Expected result:',
        `  GET /api/v3/jetton/wallets?owner_address=<recipient>&jetton_address=${masterRaw}`,
        '  should return mintless_info { amount, start_from, expire_at }',
        '',
        'TonAPI already indexes this jetton; Toncenter mintless_info is empty.',
        'Please refresh metadata cache and run mintless merkle dump indexing.',
    ].join('\n');

    return {
        network,
        onChainMaster: masterRaw,
        onChainMetadataUri,
        ourMetadataUri,
        toncenterCached,
        cacheStale,
        mintlessInfoIndexed,
        mintlessInfoSample,
        walletsIndexed,
        tonapiWorks,
        toncenterWorks,
        recommendedAction,
        bumpTargetUri,
        supportMessage,
    };
}

const OP_CHANGE_METADATA_URI = 0xcb862902;

export function buildChangeMetadataPayload(metadataUri: string): string {
    return beginCell()
        .storeUint(OP_CHANGE_METADATA_URI, 32)
        .storeUint(0, 64)
        .storeStringTail(metadataUri)
        .endCell()
        .toBoc()
        .toString('base64');
}
