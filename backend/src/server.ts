import * as fs from 'fs';
import * as path from 'path';
import express, { Request, Response } from 'express';
import { Address, Cell } from '@ton/core';
import { compile } from '@ton/blueprint';
import { cellToDictionary, merkleRootFromCell } from '../../lib/airdrop';
import { buildWalletClaimResponse } from '../../lib/claim';
import { jettonWalletCodeFromLibrary } from '../../wrappers/ui-utils';

const PORT = parseInt(process.env.PORT || '3000', 10);
const AIRDROP_BOC = path.resolve(process.env.AIRDROP_BOC_PATH || 'data/airdropData.boc');
const MINTER_JSON = path.resolve(process.env.MINTER_JSON_PATH || 'data/minter.json');

function loadMinterAddress(): Address {
    if (process.env.MINTER_ADDRESS) {
        return Address.parse(process.env.MINTER_ADDRESS);
    }
    if (!fs.existsSync(MINTER_JSON)) {
        throw new Error('Set MINTER_ADDRESS or provide data/minter.json from deploy');
    }
    const j = JSON.parse(fs.readFileSync(MINTER_JSON, 'utf8'));
    return Address.parse(j.minter);
}

async function main() {
    if (!fs.existsSync(AIRDROP_BOC)) {
        throw new Error(`Airdrop file missing: ${AIRDROP_BOC}. Run: npm run build:airdrop`);
    }

    const airdropCell = Cell.fromBoc(fs.readFileSync(AIRDROP_BOC))[0];
    const airdropDict = cellToDictionary(airdropCell);
    const merkleRoot = merkleRootFromCell(airdropCell);
    const minter = loadMinterAddress();

    const walletCodeRaw = await compile('JettonWallet');
    const walletCode = jettonWalletCodeFromLibrary(walletCodeRaw);

    const app = express();
    app.get('/health', (_req: Request, res: Response) => {
        res.json({
            ok: true,
            recipients: airdropDict.size,
            merkle_root: '0x' + merkleRoot.toString(16),
            minter: minter.toRawString(),
        });
    });

    app.get('/wallet/:address', (req: Request, res: Response) => {
        let owner: Address;
        try {
            owner = Address.parse(req.params.address);
        } catch {
            res.status(400).json({ error: 'Invalid owner address (use raw 0:... form)' });
            return;
        }

        const airdrop = airdropDict.get(owner);
        if (airdrop === undefined) {
            res.json({});
            return;
        }

        try {
            const body = buildWalletClaimResponse({
                owner,
                airdrop,
                airdropDict,
                minter,
                merkleRoot,
                walletCode,
            });
            res.json(body);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: 'Failed to build claim payload' });
        }
    });

    app.listen(PORT, () => {
        console.log(`Mintless claim API listening on port ${PORT}`);
        console.log(`  minter: ${minter.toRawString()}`);
        console.log(`  merkle: 0x${merkleRoot.toString(16)}`);
        console.log(`  recipients: ${airdropDict.size}`);
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
