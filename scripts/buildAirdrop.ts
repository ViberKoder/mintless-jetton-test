#!/usr/bin/env ts-node
/**
 * Build airdrop merkle dictionary from JSON and write artifacts for deploy + claim API.
 *
 * Usage:
 *   npx ts-node scripts/buildAirdrop.ts --input data/airdrop.json --out-dir data
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    AirdropEntry,
    buildAirdropDictionary,
    dictionaryToCell,
    merkleRootFromCell,
    totalAirdropSupply,
} from '../lib/airdrop';

function parseArgs() {
    const args = process.argv.slice(2);
    let input = 'data/airdrop.json';
    let outDir = 'data';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--input' && args[i + 1]) {
            input = args[++i];
        } else if (args[i] === '--out-dir' && args[i + 1]) {
            outDir = args[++i];
        }
    }
    return { input, outDir };
}

async function main() {
    const { input, outDir } = parseArgs();
    const inputPath = path.resolve(input);
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        console.error('Copy data/airdrop.example.json to data/airdrop.json and fill recipients.');
        process.exit(1);
    }

    const entries: AirdropEntry[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('Airdrop JSON must be a non-empty array');
    }

    const dict = buildAirdropDictionary(entries);
    const airdropCell = dictionaryToCell(dict);
    const merkleRoot = merkleRootFromCell(airdropCell);
    const totalSupply = totalAirdropSupply(dict);

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'airdropData.boc'), airdropCell.toBoc());
    fs.writeFileSync(
        path.join(outDir, 'merkle.json'),
        JSON.stringify(
            {
                merkle_root: '0x' + merkleRoot.toString(16),
                merkle_root_decimal: merkleRoot.toString(),
                recipients: entries.length,
                total_supply: totalSupply.toString(),
            },
            null,
            2,
        ),
    );

    console.log('Airdrop built successfully');
    console.log('  recipients:', entries.length);
    console.log('  total supply (nano):', totalSupply.toString());
    console.log('  merkle root:', '0x' + merkleRoot.toString(16));
    console.log('  wrote:', path.join(outDir, 'airdropData.boc'));
    console.log('  wrote:', path.join(outDir, 'merkle.json'));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
