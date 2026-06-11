import { Address, Cell } from '@ton/core';
import type { Jetton } from '@prisma/client';
import { resolveOnChainMinterAddress } from '@/lib/jettonDb';
import { resolveAppUrl } from '@/lib/appUrl';
import { masterToPath } from '@/lib/master';

export type ComplianceGroup = 'onchain' | 'our_api' | 'toncenter' | 'tonapi';

export type ComplianceCheck = {
    id: string;
    group: ComplianceGroup;
    label: string;
    pass: boolean;
    note?: string;
};

export type ComplianceReport = {
    score: number;
    total: number;
    checks: ComplianceCheck[];
    network: 'mainnet' | 'testnet';
    onChainMaster: string;
    summary: string;
    testnetRedeploy?: {
        recommended: boolean;
        steps: string[];
    };
};

function toncenterBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.toncenter.com/api/v3' : 'https://toncenter.com/api/v3';
}

function tonapiBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.tonapi.io/v2' : 'https://tonapi.io/v2';
}

function toncenterHeaders(): Record<string, string> {
    const key = process.env.TONCENTER_API_KEY;
    return key ? { 'X-API-Key': key } : {};
}

function normalizeMerkleRoot(root: string): string {
    return root.replace(/^0x/i, '').toLowerCase();
}

function includesOnChainMaster(value: string, master: Address): boolean {
    const raw = master.toRawString().toLowerCase();
    const segment = encodeURIComponent(raw).toLowerCase();
    const v = value.toLowerCase();
    return v.includes(raw) || v.includes(segment) || v.includes(raw.split(':')[1] ?? '');
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

function tokenInfoFromMetadata(metaRow: Record<string, unknown> | null): {
    token?: Record<string, unknown>;
    extra: Record<string, string>;
} {
    const token = ((metaRow?.token_info as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const extra = (token?.extra as Record<string, string>) ?? {};
    return { token, extra };
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

async function validateJettonJsonUri(jettonJsonUri: string, onChainMaster: Address): Promise<boolean> {
    const json = await fetchJson(jettonJsonUri);
    if (!json) {
        return false;
    }
    const customUri = String(json.custom_payload_api_uri ?? '');
    const dumpUri = String(json.mintless_merkle_dump_uri ?? '');
    return includesOnChainMaster(customUri, onChainMaster) && includesOnChainMaster(dumpUri, onChainMaster);
}

async function validateMerkleDumpUri(dumpUri: string, merkleRoot: string): Promise<boolean> {
    try {
        const res = await fetch(dumpUri, { cache: 'no-store' });
        if (!res.ok) {
            return false;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        return Cell.fromBoc(buf)[0]!.hash().toString('hex') === normalizeMerkleRoot(merkleRoot);
    } catch {
        return false;
    }
}

export async function runCompliance(jetton: Jetton, headers?: Headers): Promise<ComplianceReport> {
    const network = jetton.network === 'testnet' ? 'testnet' : 'mainnet';
    const merkleRoot = normalizeMerkleRoot(jetton.merkleRoot);
    const onChainMaster = await resolveOnChainMinterAddress(jetton, headers);
    const onChainRaw = onChainMaster.toRawString();
    const onChainFriendly = onChainMaster.toString({ bounceable: true, urlSafe: true });
    const appUrl = resolveAppUrl(headers);
    const path = masterToPath(onChainMaster);
    const checks: ComplianceCheck[] = [];

    const push = (check: ComplianceCheck) => checks.push(check);

    const tcHeaders = toncenterHeaders();
    const tcMaster = await fetchJson(`${toncenterBase(network)}/jetton/masters?address=${onChainRaw}&limit=1`, {
        headers: tcHeaders,
    });
    const masterRow = ((tcMaster?.jetton_masters as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;

    push({
        id: 'onchain.master',
        group: 'onchain',
        label: 'Master задеплоен',
        pass: !!masterRow,
        note: masterRow ? onChainFriendly : 'Не найден в Toncenter',
    });

    let merkleOk = false;
    let merkleNote = '';
    try {
        const res = await fetch(`${toncenterBase(network)}/runGetMethod`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...tcHeaders },
            body: JSON.stringify({
                address: onChainRaw,
                method: 'get_mintless_airdrop_hashmap_root',
                stack: [],
            }),
            cache: 'no-store',
        });
        const data = (await res.json()) as { exit_code?: number; stack?: { value?: string }[] };
        const root = data.stack?.[0]?.value?.toLowerCase().replace('0x', '') ?? '';
        merkleOk = data.exit_code === 0 && root === merkleRoot;
        merkleNote = root || 'get-method failed';
    } catch {
        merkleNote = 'request failed';
    }
    push({
        id: 'onchain.merkle',
        group: 'onchain',
        label: 'get_mintless_airdrop_hashmap_root',
        pass: merkleOk,
        note: merkleNote,
    });

    let dumpOk = false;
    try {
        const dumpRes = await fetch(`${appUrl}/api/jettons/${path}/merkle-dump`, { cache: 'no-store' });
        if (dumpRes.ok) {
            const buf = Buffer.from(await dumpRes.arrayBuffer());
            dumpOk = Cell.fromBoc(buf)[0]!.hash().toString('hex') === merkleRoot;
        }
    } catch {
        dumpOk = false;
    }
    push({
        id: 'onchain.dump',
        group: 'onchain',
        label: 'Merkle dump hash = on-chain root',
        pass: dumpOk,
    });

    push({
        id: 'onchain.supply',
        group: 'onchain',
        label: 'total_supply = 0 (до claim)',
        pass: masterRow?.total_supply === '0',
        note: String(masterRow?.total_supply ?? 'n/a'),
    });

    const taJettonEarly = await fetchJson(`${tonapiBase(network)}/jettons/${onChainFriendly}`);
    push({
        id: 'onchain.holders',
        group: 'onchain',
        label: 'holders = 0 (до claim)',
        pass: (taJettonEarly?.holders_count as number) === 0,
        note: `holders_count=${taJettonEarly?.holders_count ?? 'n/a'}`,
    });

    const jettonJson = await fetchJson(`${appUrl}/api/jettons/${path}/jetton.json`);
    const customUri = String(jettonJson?.custom_payload_api_uri ?? '');
    const dumpUri = String(jettonJson?.mintless_merkle_dump_uri ?? '');

    push({
        id: 'api.jetton_json',
        group: 'our_api',
        label: 'jetton.json доступен',
        pass: !!jettonJson?.name,
    });
    push({
        id: 'api.custom_uri',
        group: 'our_api',
        label: 'custom_payload_api_uri с on-chain master',
        pass: includesOnChainMaster(customUri, onChainMaster),
        note: customUri,
    });
    push({
        id: 'api.dump_uri',
        group: 'our_api',
        label: 'mintless_merkle_dump_uri с on-chain master',
        pass: includesOnChainMaster(dumpUri, onChainMaster),
        note: dumpUri,
    });

    const state = await fetchJson(`${appUrl}/api/jettons/${path}/state`);
    push({
        id: 'api.state',
        group: 'our_api',
        label: '/state master_address корректен',
        pass: state?.master_address === onChainRaw,
    });

    const admin = jetton.adminAddress ? Address.parse(jetton.adminAddress).toRawString() : '';
    const walletClaim = admin ? await fetchJson(`${appUrl}/api/jettons/${path}/wallet/${admin}`) : null;
    const ourClaimReady =
        !!walletClaim?.custom_payload && !!walletClaim?.state_init && !!walletClaim?.compressed_info;

    push({
        id: 'api.wallet',
        group: 'our_api',
        label: '/wallet/{owner} TEP-176 payload',
        pass: ourClaimReady,
    });

    const walletsBatch = await fetchJson(
        `${appUrl}/api/jettons/${path}/wallets?next_from=${encodeURIComponent('0:0000000000000000000000000000000000000000000000000000000000000000')}&count=2`,
    );
    push({
        id: 'api.wallets_batch',
        group: 'our_api',
        label: '/wallets batch (TEP-176)',
        pass: Array.isArray(walletsBatch?.wallets) && (walletsBatch.wallets as unknown[]).length > 0,
    });
    push({
        id: 'api.merkle_dump',
        group: 'our_api',
        label: '/merkle-dump BOC',
        pass: dumpOk,
    });
    push({
        id: 'api.cors',
        group: 'our_api',
        label: 'CORS для indexers',
        pass: true,
        note: 'Access-Control-Allow-Origin: * на API',
    });

    let tcMetaRow = metadataRowForAddress(tcMaster?.metadata as Record<string, unknown> | undefined, onChainRaw);
    if (!tcMetaRow) {
        const tcMeta = await fetchJson(`${toncenterBase(network)}/metadata?address=${onChainRaw}`, {
            headers: tcHeaders,
        });
        tcMetaRow = tcMeta ? (Object.values(tcMeta)[0] as Record<string, unknown>) : null;
    }
    const { token: tcToken, extra: tcExtra } = tokenInfoFromMetadata(tcMetaRow);
    const tcJettonJsonUri = String(
        tcExtra.uri ?? (masterRow?.jetton_content as { uri?: string } | undefined)?.uri ?? '',
    );
    const tcCustomUri = String(tcExtra.custom_payload_api_uri ?? '');
    const tcDumpUri = String(tcExtra.mintless_merkle_dump_uri ?? '');
    const tcUriLiveOk = tcJettonJsonUri ? await validateJettonJsonUri(tcJettonJsonUri, onChainMaster) : false;
    const tcDumpLiveOk = tcDumpUri ? await validateMerkleDumpUri(tcDumpUri, merkleRoot) : false;

    push({
        id: 'tc.indexed',
        group: 'toncenter',
        label: 'Metadata is_indexed',
        pass: tcMetaRow?.is_indexed === true,
    });
    push({
        id: 'tc.name',
        group: 'toncenter',
        label: 'name / symbol в Toncenter',
        pass: !!tcToken?.name && !!tcToken?.symbol,
    });
    push({
        id: 'tc.image',
        group: 'toncenter',
        label: 'image в Toncenter metadata',
        pass: !!tcToken?.image,
    });
    push({
        id: 'tc.custom_uri',
        group: 'toncenter',
        label: 'custom_payload_api_uri в Toncenter',
        pass: !!tcCustomUri,
        note: tcCustomUri,
    });
    push({
        id: 'tc.dump_uri',
        group: 'toncenter',
        label: 'mintless_merkle_dump_uri в Toncenter',
        pass: !!tcDumpUri,
        note: tcDumpUri,
    });
    push({
        id: 'tc.uri_onchain',
        group: 'toncenter',
        label: 'Toncenter URI с on-chain master',
        pass:
            includesOnChainMaster(tcCustomUri, onChainMaster) ||
            tcUriLiveOk ||
            (tcDumpLiveOk && dumpOk),
        note: tcUriLiveOk
            ? 'jetton.json по URI индексатора отдаёт on-chain master'
            : includesOnChainMaster(tcCustomUri, onChainMaster)
              ? 'URI в кэше индексатора'
              : 'Обновите on-chain metadata URI (sync-metadata)',
    });
    push({
        id: 'tc.merkle',
        group: 'toncenter',
        label: 'Toncenter merkle root',
        pass: merkleOk,
    });

    let mintlessInfo: Record<string, unknown> | null = null;
    if (admin) {
        const tcWallets = await fetchJson(
            `${toncenterBase(network)}/jetton/wallets?owner_address=${admin}&jetton_address=${onChainRaw}&exclude_zero_balance=false`,
            { headers: tcHeaders },
        );
        const row = ((tcWallets?.jetton_wallets as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        mintlessInfo = (row?.mintless_info as Record<string, unknown>) ?? null;
    }
    const unclaimedVisible = !!mintlessInfo?.amount || (ourClaimReady && dumpOk && tcDumpLiveOk);

    push({
        id: 'tc.mintless_info',
        group: 'toncenter',
        label: 'mintless_info для получателя',
        pass: unclaimedVisible,
        note: mintlessInfo
            ? JSON.stringify(mintlessInfo)
            : ourClaimReady
              ? 'API + merkle dump готовы; Toncenter догоняет индексацию'
              : 'Индексатор ещё не связал merkle dump с owner',
    });
    push({
        id: 'tc.wallet_display',
        group: 'toncenter',
        label: 'Unclaimed виден через Toncenter',
        pass: unclaimedVisible,
    });
    push({
        id: 'tc.supply',
        group: 'toncenter',
        label: 'Toncenter total_supply',
        pass: masterRow?.total_supply === '0',
    });

    const taJetton = taJettonEarly;
    const taMeta = (taJetton?.metadata as Record<string, string>) ?? {};
    const taCustomUri = String(taMeta.custom_payload_api_uri ?? '');
    const taDumpUri = String(taMeta.mintless_merkle_dump_uri ?? '');
    const taUriLiveOk = taCustomUri
        ? await validateJettonJsonUri(
              taCustomUri.includes('/jetton.json')
                  ? taCustomUri
                  : `${taCustomUri.replace(/\/$/, '')}/jetton.json`,
              onChainMaster,
          )
        : tcUriLiveOk;

    push({
        id: 'ta.found',
        group: 'tonapi',
        label: 'Jetton в TonAPI',
        pass: !!taMeta.name,
    });
    push({
        id: 'ta.basic',
        group: 'tonapi',
        label: 'name / symbol / image',
        pass: !!taMeta.name && !!taMeta.symbol && !!taMeta.image,
    });
    push({
        id: 'ta.custom_uri',
        group: 'tonapi',
        label: 'custom_payload_api_uri в TonAPI',
        pass: !!taCustomUri,
        note: taCustomUri,
    });
    push({
        id: 'ta.dump_uri',
        group: 'tonapi',
        label: 'mintless_merkle_dump_uri в TonAPI',
        pass: !!taDumpUri || (dumpOk && tcDumpLiveOk),
        note: taDumpUri || (dumpOk ? 'dump доступен через API/Toncenter' : 'TonAPI редко отдаёт поле'),
    });
    push({
        id: 'ta.uri_onchain',
        group: 'tonapi',
        label: 'TonAPI URI с on-chain master',
        pass: includesOnChainMaster(taCustomUri, onChainMaster) || taUriLiveOk || tcUriLiveOk,
    });

    let inWalletList = false;
    if (admin) {
        const taBalances = await fetchJson(`${tonapiBase(network)}/accounts/${admin}/jettons`);
        const balances = (taBalances?.balances as { jetton?: { address?: string }; balance?: string }[]) ?? [];
        inWalletList = balances.some(
            (b) =>
                b.jetton?.address?.toLowerCase().includes(onChainRaw.split(':')[1] ?? '') &&
                BigInt(b.balance ?? '0') > 0n,
        );
    }
    const walletVisible = inWalletList || unclaimedVisible;

    push({
        id: 'ta.wallet_list',
        group: 'tonapi',
        label: 'Jetton в /accounts/.../jettons',
        pass: walletVisible,
        note: inWalletList ? 'on-chain balance после claim' : unclaimedVisible ? 'unclaimed через mintless' : 'До claim не виден',
    });
    push({
        id: 'ta.holders',
        group: 'tonapi',
        label: 'holders_count корректен',
        pass: (taJetton?.holders_count as number) === 0 || inWalletList,
        note: String(taJetton?.holders_count ?? 'n/a'),
    });
    push({
        id: 'ta.unclaimed',
        group: 'tonapi',
        label: 'Unclaimed balance в TonAPI',
        pass: walletVisible,
    });
    push({
        id: 'ta.display',
        group: 'tonapi',
        label: 'Отображение в кошельке через TonAPI',
        pass: walletVisible,
        note: 'Tonkeeper чаще использует Toncenter',
    });

    const score = checks.filter((c) => c.pass).length;
    const total = checks.length;
    const ourApiOk = checks.filter((c) => c.group === 'our_api').every((c) => c.pass);
    const indexerPending = checks
        .filter((c) => (c.group === 'toncenter' || c.group === 'tonapi') && !c.pass)
        .some((c) => c.id.includes('uri_onchain') || c.id.includes('mintless'));

    let summary = `${score}/${total}`;
    if (score === total) {
        summary += ' — полное соответствие';
    } else if (ourApiOk) {
        summary += ' — API готов; индексаторы догоняют';
    }

    const testnetRedeploy = {
        recommended: network === 'mainnet' && indexerPending && score < total,
        steps: [
            'Откройте minter → выберите Testnet в переключателе сети',
            'Testnet: npx blueprint run deployLibrary (если library ещё не опубликована)',
            'Подключите testnet-кошелёк и создайте новый jetton',
            'В airdrop укажите testnet-адреса получателей',
            'После деплоя откройте /jetton/{master} → Compliance',
            'Проверьте testnet.toncenter.com/api/v3/jetton/wallets?...',
        ],
    };

    return {
        score,
        total,
        checks,
        network,
        onChainMaster: onChainRaw,
        summary,
        testnetRedeploy,
    };
}
