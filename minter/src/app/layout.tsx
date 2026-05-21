import type { Metadata } from 'next';
import { TonConnectProvider } from '@/components/TonConnectButton';
import './globals.css';

export const metadata: Metadata = {
    title: 'Mintless Jetton Minter',
    description: 'Создайте mintless jetton: metadata, airdrop, Merkle tree, TON Connect deploy',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ru">
            <body>
                <TonConnectProvider>{children}</TonConnectProvider>
            </body>
        </html>
    );
}
