import { Address, beginCell, Cell, Dictionary, DictionaryValue, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import '@ton/test-utils';
import { jettonContentToCell, JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { buildWalletClaimResponse } from '../lib/claim';
import { buff2bigint } from './utils';
import { Op } from '../wrappers/JettonConstants';
import { testJettonInternalTransfer } from './utils';

type AirdropData = {
    amount: bigint;
    start_from: number;
    expire_at: number;
};

const airDropValue: DictionaryValue<AirdropData> = {
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

/** Sandbox bridge: TEP-176 claim API payload must work on deployed mintless minter. */
describe('TEP-176 claim API (lib/claim) vs sandbox', () => {
    const AIRDROP_START = 1000;
    const AIRDROP_END = 2000;

    let walletCode: Cell;
    let minterCode: Cell;
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let recipient: SandboxContract<TreasuryContract>;
    let cMaster: SandboxContract<JettonMinter>;
    let airdropDict: Dictionary<Address, AirdropData>;
    let airdropCell: Cell;
    let merkleRoot: bigint;

    beforeAll(async () => {
        walletCode = await compile('JettonWallet');
        minterCode = await compile('JettonMinter');

        blockchain = await Blockchain.create();
        blockchain.now = AIRDROP_START;
        deployer = await blockchain.treasury('deployer');
        recipient = await blockchain.treasury('recipient');

        const libs = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        libs.set(BigInt(`0x${walletCode.hash().toString('hex')}`), walletCode);
        blockchain.libs = beginCell().storeDictDirect(libs).endCell();

        airdropDict = Dictionary.empty(Dictionary.Keys.Address(), airDropValue);
        airdropDict.set(recipient.address, {
            amount: toNano('42'),
            start_from: AIRDROP_START,
            expire_at: AIRDROP_END,
        });

        airdropCell = beginCell().storeDictDirect(airdropDict).endCell();
        merkleRoot = buff2bigint(airdropCell.hash(0));

        cMaster = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: deployer.address,
                    wallet_code: walletCode,
                    merkle_root: merkleRoot,
                    jetton_content: jettonContentToCell({ uri: 'https://example.test/jetton.json' }),
                },
                minterCode,
            ),
        );

        await cMaster.sendDeploy(deployer.getSender(), toNano('10'));
    });

    it('merkle dump BOC hash matches get_mintless_airdrop_hashmap_root', async () => {
        const dump = airdropCell.toBoc();
        const dumpRoot = buff2bigint(Cell.fromBoc(dump)[0]!.hash(0));

        const onChainRoot = await cMaster.getMintlessAirdropHashmapRoot();

        expect(dumpRoot).toEqual(merkleRoot);
        expect(onChainRoot).toEqual(merkleRoot);
    });

    it('buildWalletClaimResponse matches TEP-176 shape and claims on-chain', async () => {
        const api = buildWalletClaimResponse({
            owner: recipient.address,
            airdrop: airdropDict.get(recipient.address)!,
            airdropDict,
            minter: cMaster.address,
            merkleRoot,
            walletCode,
        });

        expect(api.owner).toBe(recipient.address.toRawString());
        expect(api.custom_payload).toBeTruthy();
        expect(api.state_init).toBeTruthy();
        expect(api.compressed_info.amount).toBe(toNano('42').toString());
        expect(api.compressed_info.start_from).toBe(String(AIRDROP_START));
        expect(api.compressed_info.expired_at).toBe(String(AIRDROP_END));

        const expectedWallet = JettonWallet.createFromConfig(
            {
                ownerAddress: recipient.address,
                jettonMasterAddress: cMaster.address,
                merkleRoot,
                salt: await cMaster.getWalletSalt(recipient.address),
            },
            walletCode,
        );
        expect(api.jetton_wallet).toBe(expectedWallet.address.toRawString());

        const claimPayload = Cell.fromBoc(Buffer.from(api.custom_payload, 'base64'))[0]!;
        const transferAmount = toNano('1');
        const wallet = blockchain.openContract(expectedWallet);

        const res = await wallet.sendTransfer(
            recipient.getSender(),
            toNano('1'),
            transferAmount,
            deployer.address,
            deployer.address,
            claimPayload,
            1n,
        );

        expect(res.transactions).toHaveTransaction({
            on: wallet.address,
            aborted: false,
            deploy: true,
        });

        const deployerWallet = JettonWallet.createFromConfig(
            {
                ownerAddress: deployer.address,
                jettonMasterAddress: cMaster.address,
                merkleRoot,
                salt: await cMaster.getWalletSalt(deployer.address),
            },
            walletCode,
        );
        const deployerJetton = blockchain.openContract(deployerWallet);

        expect(res.transactions).toHaveTransaction({
            on: deployerJetton.address,
            from: wallet.address,
            op: Op.internal_transfer,
            body: (b) =>
                testJettonInternalTransfer(b!, {
                    amount: transferAmount,
                    from: recipient.address,
                }),
            success: true,
        });

        expect(await wallet.getJettonBalance()).toEqual(toNano('42') - transferAmount);
        expect(await wallet.getWalletStatus()).toBe(1);
    });

    it('has no airdrop entry for non-recipient owner', async () => {
        const outsider = await blockchain.treasury('outsider');
        expect(airdropDict.get(outsider.address)).toBeUndefined();
    });
});
