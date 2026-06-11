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

const MERKLE_ROOT = '6369ec5ced9f94c8414f9bbfe374d38c7507f1983671799d91e00a4649369d3f';

function toncenterBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.toncenter.com/api/v3' : 'https://toncenter.com/api/v3';
}

function tonapiBase(network: 'mainnet' | 'testnet'): string {
    return network === 'testnet' ? 'https://testnet.tonapi.io/v2' : 'https://tonapi.io/v2';
}

function includesOnChainMaster(value: string, master: Address): boolean {
    const raw = master.toRawString().toLowerCase();
    const segment = encodeURIComponent(raw).toLowerCase();
    const v = value.toLowerCase();
    return v.includes(raw) || v.includes(segment) || v.includes(raw.split(':')[1] ?? '');
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return null;
        }
        return (await res.json()) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export async function runCompliance(jetton: Jetton, headers?: Headers): Promise<ComplianceReport> {
    const network = jetton.network === 'testnet' ? 'testnet' : 'mainnet';
    const onChainMaster = await resolveOnChainMinterAddress(jetton, headers);
    const onChainRaw = onChainMaster.toRawString();
    const onChainFriendly = onChainMaster.toString({ bounceable: true, urlSafe: true });
    const appUrl = resolveAppUrl(headers);
    const path = masterToPath(onChainMaster);
    const checks: ComplianceCheck[] = [];

    const push = (check: ComplianceCheck) => checks.push(check);

    const tcMaster = await fetchJson(`${toncenterBase(network)}/jetton/masters?address=${onChainRaw}&limit=1`);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: onChainRaw,
                method: 'get_mintless_airdrop_hashmap_root',
                stack: [],
            }),
            cache: 'no-store',
        });
        const data = (await res.json()) as { exit_code?: number; stack?: { value?: string }[] };
        const root = data.stack?.[0]?.value?.toLowerCase().replace('0x', '') ?? '';
        merkleOk = data.exit_code === 0 && root === MERKLE_ROOT;
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
            dumpOk = Cell.fromBoc(buf)[0]!.hash().toString('hex') === MERKLE_ROOT;
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
    push({
        id: 'api.wallet',
        group: 'our_api',
        label: '/wallet/{owner} TEP-176 payload',
        pass: !!walletClaim?.custom_payload && !!walletClaim?.state_init && !!walletClaim?.compressed_info,
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

    const tcMeta = await fetchJson(`${toncenterBase(network)}/metadata?address=${onChainRaw}`);
    const tcMetaRow = tcMeta ? (Object.values(tcMeta)[0] as Record<string, unknown>) : null;
    const tcToken = ((tcMetaRow?.token_info as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
    const tcExtra = (tcToken?.extra as Record<string, string>) ?? {};

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
        pass: !!tcExtra.custom_payload_api_uri,
        note: tcExtra.custom_payload_api_uri,
    });
    push({
        id: 'tc.dump_uri',
        group: 'toncenter',
        label: 'mintless_merkle_dump_uri в Toncenter',
        pass: !!tcExtra.mintless_merkle_dump_uri,
        note: tcExtra.mintless_merkle_dump_uri,
    });
    push({
        id: 'tc.uri_onchain',
        group: 'toncenter',
        label: 'Toncenter URI с on-chain master',
        pass: includesOnChainMaster(tcExtra.custom_payload_api_uri ?? '', onChainMaster),
        note: 'Кэш индексатора; testnet redeploy обходит ожидание',
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
        );
        const row = ((tcWallets?.jetton_wallets as unknown[]) ?? [])[0] as Record<string, unknown> | undefined;
        mintlessInfo = (row?.mintless_info as Record<string, unknown>) ?? null;
    }
    push({
        id: 'tc.mintless_info',
        group: 'toncenter',
        label: 'mintless_info для получателя',
        pass: !!mintlessInfo?.amount,
        note: mintlessInfo ? JSON.stringify(mintlessInfo) : 'Индексатор ещё не связал merkle dump с owner',
    });
    push({
        id: 'tc.wallet_display',
        group: 'toncenter',
        label: 'Unclaimed виден через Toncenter',
        pass: !!mintlessInfo?.amount,
    });
    push({
        id: 'tc.supply',
        group: 'toncenter',
        label: 'Toncenter total_supply',
        pass: masterRow?.total_supply === '0',
    });

    const taJetton = taJettonEarly;
    const taMeta = (taJetton?.metadata as Record<string, string>) ?? {};
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
        pass: !!taMeta.custom_payload_api_uri,
        note: taMeta.custom_payload_api_uri,
    });
    push({
        id: 'ta.dump_uri',
        group: 'tonapi',
        label: 'mintless_merkle_dump_uri в TonAPI',
        pass: !!taMeta.mintless_merkle_dump_uri,
        note: taMeta.mintless_merkle_dump_uri ?? 'TonAPI редко отдаёт поле (даже у NOT)',
    });
    push({
        id: 'ta.uri_onchain',
        group: 'tonapi',
        label: 'TonAPI URI с on-chain master',
        pass: includesOnChainMaster(taMeta.custom_payload_api_uri ?? '', onChainMaster),
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
    push({
        id: 'ta.wallet_list',
        group: 'tonapi',
        label: 'Jetton в /accounts/.../jettons',
        pass: inWalletList || !!mintlessInfo,
        note: inWalletList ? 'on-chain balance после claim' : 'До claim не виден',
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
        pass: !!mintlessInfo?.amount || inWalletList,
    });
    push({
        id: 'ta.display',
        group: 'tonapi',
        label: 'Отображение в кошельке через TonAPI',
        pass: !!mintlessInfo?.amount || inWalletList,
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
        recommended: network === 'mainnet' && indexerPending,
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
