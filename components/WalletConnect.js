/**
 * Wallet connect UI (Shop page). Single button opens Web3Auth modal with all options.
 */
import { useWallet } from '../lib/wallet';
import { useWalletContext } from '../lib/Web3AuthContext';
import { BASE_SEPOLIA_CHAIN_ID } from '../lib/contracts';

// Wallet icon
const WalletIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
  </svg>
);

export function WalletConnectButton({ user }) {
  const { isConnected, address, chainId, disconnect } = useWallet();
  const ctx = useWalletContext();

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
        <button
          onClick={disconnect}
          className="text-gray-400 hover:text-white text-xs underline ml-2"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (ctx?.isInitializing) {
    return (
      <div className="text-gray-400 text-sm">Initializing wallet...</div>
    );
  }

  // Two options: MetaMask direct (recommended) or Web3Auth (social login)
  return (
    <div className="space-y-3">
      {/* Direct MetaMask - recommended for switching networks */}
      <button
        type="button"
        onClick={ctx?.connectMetaMask}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium text-white transition-all hover:scale-[1.02] bg-orange-600 hover:bg-orange-500"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.3 4.4L13.8 9.8l1.4-3.3L21.3 4.4zM2.7 4.4l7.4 5.5-1.3-3.4L2.7 4.4zm15.5 12.2l-2 3 4.3 1.2 1.2-4.2h-3.5zm-14.9 0l1.2 4.2 4.3-1.2-2-3H3.3z"/>
        </svg>
        <span>Connect MetaMask</span>
      </button>

      {/* Web3Auth for social login */}
      {ctx?.web3authReady && (
        <button
          type="button"
          onClick={ctx.connect}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium text-white transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}
        >
          <WalletIcon />
          <span>Social Login (Google, etc.)</span>
        </button>
      )}

      <p className="text-gray-500 text-xs text-center">
        Use MetaMask for full network control
      </p>
    </div>
  );
}

export function WalletStatus() {
  const { isConnected, address, chainId, walletType } = useWallet();
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
      {walletType === 'web3auth' && (
        <span className="text-xs text-purple-400">(Social)</span>
      )}
      {!onBaseSepolia && (
        <span className="text-amber-400 text-xs">Wrong network</span>
      )}
    </div>
  );
}

export default function WalletConnect({ user }) {
  return <WalletConnectButton user={user} />;
}
