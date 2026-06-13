#!/usr/bin/env node
/**
 * TEP-176 / claim-api-go compatibility checks.
 * Usage: node scripts/verify-claim-api.mjs [baseUrl] [masterFriendly]
 */

const BASE = process.argv[2] ?? 'https://thorough-love-production-f1eb.up.railway.app';
const FRIENDLY = process.argv[3] ?? 'EQDQBDEh04bDZkqKd5eCI6AkqVTnB8e27xXmrn5509VC-xIf';
const ADMIN = '0:d6e5c1384420cd5bf2b4658839af145171b50550e76e6f0d6365aa5c437c3dbd';
const ZERO = '0:0000000000000000000000000000000000000000000000000000000000000000';
const ROOT = `/api/v1/jettons/${FRIENDLY}`;

const results = [];

function record(name, pass, detail = '') {
    results.push({ name, pass, detail });
    const mark = pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path) {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }
    return { res, json };
}

function hasClaimFields(wallet) {
    return (
        wallet &&
        typeof wallet.owner === 'string' &&
        typeof wallet.jetton_wallet === 'string' &&
        typeof wallet.custom_payload === 'string' &&
        typeof wallet.state_init === 'string' &&
        wallet.compressed_info &&
        typeof wallet.compressed_info.amount === 'string' &&
        typeof wallet.compressed_info.start_from === 'string' &&
        typeof wallet.compressed_info.expired_at === 'string'
    );
}

async function main() {
    console.log(`Base: ${BASE}`);
    console.log(`Master: ${FRIENDLY}\n`);

    const jettonJson = await get(`${ROOT}/jetton.json`);
    const customUri = jettonJson.json?.custom_payload_api_uri ?? '';
    const dumpUri = jettonJson.json?.mintless_merkle_dump_uri ?? '';
    record('GET jetton.json', jettonJson.res.status === 200 && jettonJson.json?.name, jettonJson.json?.name);
    record('custom_payload_api_uri v1/friendly', customUri === `${BASE}${ROOT}`, customUri);
    record('mintless_merkle_dump_uri .boc', dumpUri === `${BASE}${ROOT}/merkle-dump.boc`, dumpUri);

    const state = await get(`${ROOT}/state`);
    record(
        'GET /state',
        state.res.status === 200 &&
            typeof state.json?.total_wallets === 'number' &&
            typeof state.json?.master_address === 'string' &&
            state.json.master_address.startsWith('0:'),
        `total=${state.json?.total_wallets}`,
    );

    const wallet = await get(`${ROOT}/wallet/${ADMIN}`);
    record('GET /wallet/{owner}', wallet.res.status === 200 && hasClaimFields(wallet.json), wallet.json?.owner);

    const wallets = await get(`${ROOT}/wallets?next_from=${encodeURIComponent(ZERO)}&count=2`);
    const batch = wallets.json?.wallets ?? [];
    record(
        'GET /wallets batch',
        wallets.res.status === 200 &&
            Array.isArray(batch) &&
            batch.length > 0 &&
            batch.every((w) => w.owner && w.compressed_info),
        `count=${batch.length} next_from=${wallets.json?.next_from ?? ''}`,
    );

    const dump = await fetch(`${BASE}${ROOT}/merkle-dump.boc`, { cache: 'no-store' });
    const dumpBuf = Buffer.from(await dump.arrayBuffer());
    record('GET merkle-dump.boc', dump.status === 200 && dumpBuf.length > 100, `${dumpBuf.length} bytes`);

    const cors = wallet.res.headers.get('access-control-allow-origin');
    record('CORS', cors === '*', cors ?? 'missing');

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} claim-api checks passed`);
    process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
