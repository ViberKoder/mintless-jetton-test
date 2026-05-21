import * as fs from 'fs';
import * as path from 'path';
import { Address, Cell, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { jettonWalletCodeFromLibrary } from '../wrappers/ui-utils';
import { buff2bigint } from '../lib/airdrop';

function env(name: string, required = true): string {
    const v = process.env[name];
    if (required && (!v || v.trim() === '')) {
        throw new Error(`Missing required env: ${name}`);
    }
    return v ?? '';
}

function loadMerkleRoot(): bigint {
    const hex = env('MERKLE_ROOT', false);
    if (hex) {
        const normalized = hex.startsWith('0x') ? hex : '0x' + hex;
        return BigInt(normalized);
    }
    const merklePath = path.resolve(env('MERKLE_JSON_PATH', false) || 'data/merkle.json');
    if (fs.existsSync(merklePath)) {
        const j = JSON.parse(fs.readFileSync(merklePath, 'utf8'));
        return BigInt(j.merkle_root);
    }
    const bocPath = path.resolve(env('AIRDROP_BOC_PATH', false) || 'data/airdropData.boc');
    if (fs.existsSync(bocPath)) {
        const cell = Cell.fromBoc(fs.readFileSync(bocPath))[0];
        return buff2bigint(cell.hash(0));
    }
    throw new Error('Set MERKLE_ROOT, MERKLE_JSON_PATH, or AIRDROP_BOC_PATH');
}

export async function run(provider: NetworkProvider) {
    const admin = Address.parse(env('ADMIN_ADDRESS'));
    const metadataUri = env('JETTON_METADATA_URI');
    const deployAmount = toNano(env('DEPLOY_AMOUNT_TON', false) || '1.5');
    const merkleRoot = loadMerkleRoot();
    const outDir = path.resolve(env('OUTPUT_DIR', false) || 'data');

    const jettonWalletCodeRaw = await compile('JettonWallet');
    const walletCode = jettonWalletCodeFromLibrary(jettonWalletCodeRaw);
    const minterCode = await compile('JettonMinter');

    const minter = provider.open(
        JettonMinter.createFromConfig(
            {
                admin,
                wallet_code: walletCode,
                merkle_root: merkleRoot,
                jetton_content: { uri: metadataUri },
            },
            minterCode,
        ),
    );

    await minter.sendDeploy(provider.sender(), deployAmount);
    await provider.waitForDeploy(minter.address);

    fs.mkdirSync(outDir, { recursive: true });
    const deployment = {
        network: provider.network(),
        minter: minter.address.toString(),
        minter_raw: minter.address.toRawString(),
        admin: admin.toString(),
        merkle_root: '0x' + merkleRoot.toString(16),
        metadata_uri: metadataUri,
    };
    fs.writeFileSync(path.join(outDir, 'minter.json'), JSON.stringify(deployment, null, 2));

    console.log('Mintless jetton minter deployed');
    console.log(JSON.stringify(deployment, null, 2));
}
