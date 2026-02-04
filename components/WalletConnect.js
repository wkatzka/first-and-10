/**
 * Wallet connect UI (Shop page). Shown only when cryptoShopEnabled (local).
 */
import { useWallet } from '../lib/wallet';
import { useWalletContext } from '../lib/Web3AuthContext';
import { BASE_SEPOLIA_CHAIN_ID } from '../lib/contracts';

export function WalletConnectButton({ user }) {
  const { isConnected, address, connect, chainId } = useWallet();

  if (isConnected) {
    const onBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-green-400 font-mono text-sm truncate max-w-[140px]">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        {!onBaseSepolia && (
          <span className="text-amber-400 text-xs">Switch to Base Sepolia</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
      style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.4)' }}
    >
      Connect Wallet
    </button>
  );
}

export function WalletStatus() {
  const { isConnected, address, chainId } = useWallet();
  const onBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;

  if (!isConnected) {
    return <span className="text-gray-400 text-sm">Not connected</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      <span className="font-mono text-sm text-gray-300 truncate max-w-[120px]">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      {!onBaseSepolia && (
        <span className="text-amber-400 text-xs">Wrong network</span>
      )}
    </div>
  );
}

export default function WalletConnect({ user }) {
  return <WalletConnectButton user={user} />;
}
