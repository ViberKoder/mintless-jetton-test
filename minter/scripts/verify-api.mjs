#!/usr/bin/env node
/**
 * End-to-end API verification for mintless jetton minter.
 * Usage: node scripts/verify-api.mjs [baseUrl] [masterRaw]
 */

const BASE = process.argv[2] ?? 'https://thorough-love-production-f1eb.up.railway.app';
const MASTER = process.argv[3] ?? '0:d0043121d386c3664a8a77978223a024a954e707c7b6ef15e6ae7e79d3d542fb';
const ADMIN = '0:d6e5c1384420cd5bf2b4658839af145171b50550e76e6f0d6365aa5c437c3dbd';
const ZERO = '0:0000000000000000000000000000000000000000000000000000000000000000';
const MERKLE = '6369ec5ced9f94c8414f9bbfe374d38c7507f1983671799d91e00a4649369d3f';
const PATH = encodeURIComponent(MASTER).toLowerCase();

const results = [];

function record(name, pass, detail = '') {
    results.push({ name, pass, detail });
    const mark = pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function get(path, opts) {
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let json = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }
    return { res, text, json };
}

async function main() {
    console.log(`Base: ${BASE}`);
    console.log(`Master: ${MASTER}\n`);

    const health = await get('/api/health');
    record('GET /api/health', health.res.status === 200 && health.json?.ok === true, `HTTP ${health.res.status}`);

    const jettonJson = await get(`/api/jettons/${PATH}/jetton.json`);
    const cors = jettonJson.res.headers.get('access-control-allow-origin');
    const customUri = jettonJson.json?.custom_payload_api_uri ?? '';
    const dumpUri = jettonJson.json?.mintless_merkle_dump_uri ?? '';
    record('GET jetton.json', jettonJson.res.status === 200 && jettonJson.json?.name === 'Mint', `HTTP ${jettonJson.res.status}`);
    record('jetton.json CORS', cors === '*', cors ?? 'missing');
    record('jetton.json on-chain URIs', customUri.includes(MASTER.split(':')[1]) && dumpUri.includes(MASTER.split(':')[1]));

    const state = await get(`/api/jettons/${PATH}/state`);
    record('GET /state', state.res.status === 200 && state.json?.master_address === MASTER, state.json?.master_address);

    const dump = await fetch(`${BASE}/api/jettons/${PATH}/merkle-dump`);
    const dumpBuf = Buffer.from(await dump.arrayBuffer());
    record('GET /merkle-dump', dump.status === 200 && dumpBuf.length > 100, `${dumpBuf.length} bytes`);

    const { Cell } = await import('@ton/core');
    const dumpHash = Cell.fromBoc(dumpBuf)[0].hash().toString('hex');
    record('merkle-dump hash', dumpHash === MERKLE, dumpHash);

    const wallet = await get(`/api/jettons/${PATH}/wallet/${ADMIN}`);
    record(
        'GET /wallet/{admin}',
        wallet.res.status === 200 && wallet.json?.custom_payload && wallet.json?.state_init,
        wallet.res.status === 200 ? 'claim payload ok' : `HTTP ${wallet.res.status}`,
    );

    const wallets = await get(`/api/jettons/${PATH}/wallets?next_from=${encodeURIComponent(ZERO)}&count=2`);
    record(
        'GET /wallets batch',
        wallets.res.status === 200 && Array.isArray(wallets.json?.wallets) && wallets.json.wallets.length > 0,
        `count=${wallets.json?.wallets?.length ?? 0}`,
    );

    const syncMeta = await get(`/api/jettons/${PATH}/sync-metadata`);
    record('GET /sync-metadata', syncMeta.res.status === 200 && syncMeta.json?.targetUri, syncMeta.json?.needsSync ? 'needs sync' : 'aligned');

    const compliance = await get(`/api/jettons/${PATH}/compliance`);
    const score = compliance.json?.score ?? 0;
    const total = compliance.json?.total ?? 32;
    const failed = (compliance.json?.checks ?? []).filter((c) => !c.pass).map((c) => c.id);
    record('GET /compliance', compliance.res.status === 200 && score === total, `${score}/${total} failed=[${failed.join(', ')}]`);

    const jetton = await get(`/api/jettons/${PATH}`);
    record('GET /api/jettons/{master}', jetton.res.status === 200 && jetton.json?.merkleRoot, jetton.json?.status);

    const deployNoAdmin = await get(`/api/jettons/${PATH}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    });
    record('POST /deploy validation', deployNoAdmin.res.status === 400, `HTTP ${deployNoAdmin.res.status}`);

  // old metadata path alias
    const OLD_PATH = '0%3A3f97627d33f1e804189741b94a748e67a2b48c5e1dfe5168d071dd98f38e4b18';
    const oldJson = await get(`/api/jettons/${OLD_PATH}/jetton.json`);
    record('legacy path jetton.json', oldJson.res.status === 200 && oldJson.json?.name === 'Mint');

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n${passed}/${results.length} checks passed`);
    process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
