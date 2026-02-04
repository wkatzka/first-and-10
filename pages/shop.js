/**
 * Shop Page (local only)
 * ======================
 * Purchase NFT packs with ETH. Only available when running locally (cryptoShopEnabled).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { WalletConnectButton, WalletStatus } from '../components/WalletConnect';
import { useWallet } from '../lib/wallet';
import { OnrampCard } from '../components/CoinbaseOnramp';
import { BuyPackButton } from '../components/BuyPackButton';
import { CURRENT_NETWORK } from '../lib/contracts';
import { cryptoShopEnabled } from '../lib/env';

export default function Shop({ user, onLogout, unreadMessages }) {
  const router = useRouter();
  const { isConnected, address } = useWallet();

  useEffect(() => {
    if (!cryptoShopEnabled) {
      router.replace('/');
      return;
    }
    if (!user) {
      router.push('/');
    }
  }, [user, router]);

  if (!cryptoShopEnabled) return null;
  if (!user) return null;

  const handlePurchaseSuccess = ({ txHash }) => {
    console.log('Purchase successful:', txHash);
  };

  return (
    <Layout user={user} onLogout={onLogout} unreadMessages={unreadMessages}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pack Shop</h1>
          <p className="text-gray-400">
            Purchase card packs with ETH. Each pack contains 5 random player cards.
          </p>
          {CURRENT_NETWORK === 'baseSepolia' && (
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-yellow-900/30 border border-yellow-500/30">
              <span className="text-yellow-400 text-sm">🧪 Testnet Mode</span>
            </div>
          )}
        </div>

        <div className="f10-panel p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Your Wallet</h2>
            <WalletStatus />
          </div>

          {!isConnected ? (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-4">
                Connect your wallet to purchase packs
              </p>
              <WalletConnectButton />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono text-sm">{address}</span>
              </div>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="mb-6">
            <OnrampCard />
          </div>
        )}

        {isConnected && (
          <BuyPackButton onSuccess={handlePurchaseSuccess} />
        )}

        <div className="mt-8 p-6 f10-panel">
          <h3 className="text-lg font-bold text-white mb-4">How It Works</h3>
          <ol className="space-y-3 text-gray-400">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
              <span>Connect your wallet (Web3Auth or MetaMask)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">2</span>
              <span>Add ETH to your wallet (testnet faucet or buy)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">3</span>
              <span>Click &quot;Buy Pack&quot; and confirm the transaction</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">4</span>
              <span>Your NFT cards will be minted to your wallet!</span>
            </li>
          </ol>
        </div>

        <div className="mt-6 p-6 f10-panel">
          <h3 className="text-lg font-bold text-white mb-4">FAQ</h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-white font-medium">What is ETH?</p>
              <p className="text-gray-400">ETH (Ether) is the cryptocurrency used on Base network. You need it to buy packs and pay transaction fees.</p>
            </div>
            <div>
              <p className="text-white font-medium">What are gas fees?</p>
              <p className="text-gray-400">Gas fees are small transaction costs (~$0.01-0.05 on Base). They go to the network, not us.</p>
            </div>
            <div>
              <p className="text-white font-medium">Are the cards real NFTs?</p>
              <p className="text-gray-400">Yes! Each card is an ERC-721 NFT on the Base blockchain. You own them in your wallet and can transfer them.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
