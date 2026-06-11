import { CreateJettonWizard } from '@/components/CreateJettonWizard';
import { TonConnectButton } from '@/components/TonConnectButton';

export default function HomePage() {
    return (
        <main className="container">
            <div className="header-row">
                <div>
                    <h1>Mintless Jetton Minter</h1>
                    <p className="muted">
                        Заполните метаданные и airdrop JSON — приложение построит Merkle tree, сохранит в БД и
                        отдаст claim API. Деплой minter в testnet или mainnet через TON Connect.
                    </p>
                </div>
                <TonConnectButton />
            </div>
            <CreateJettonWizard />
        </main>
    );
}
