/**
 * Coinbase Onramp - Add ETH to wallet via Coinbase Pay or faucet (testnet).
 */
import { useState, useEffect, useCallback } from 'react';
import { initOnRamp } from '@coinbase/cbpay-js';
import { useWallet } from '../lib/wallet';
import { CURRENT_NETWORK } from '../lib/contracts';

const FAUCET_URL = 'https://portal.cdp.coinbase.com/products/faucet';

// Coinbase Pay only works on mainnet, so we show faucet for testnet
const isTestnet = CURRENT_NETWORK === 'baseSepolia';

// Coinbase Pay app ID (you'll need to register at pay.coinbase.com/onramp)
const COINBASE_APP_ID = process.env.NEXT_PUBLIC_COINBASE_APP_ID || '';

export function CoinbasePayButton({ destinationAddress }) {
  const [isReady, setIsReady] = useState(false);
  const [onrampInstance, setOnrampInstance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!destinationAddress || !COINBASE_APP_ID || isTestnet) return;

    let instance = null;

    const initPay = async () => {
      try {
        instance = await initOnRamp({
          appId: COINBASE_APP_ID,
          widgetParameters: {
            destinationWallets: [{
              address: destinationAddress,
              blockchains: ['base'],
              assets: ['ETH'],
            }],
          },
          onSuccess: () => {
            console.log('Coinbase Pay: Purchase successful');
          },
          onExit: () => {
            console.log('Coinbase Pay: User exited');
          },
          onEvent: (event) => {
            console.log('Coinbase Pay event:', event);
          },
          experienceLoggedIn: 'popup',
          experienceLoggedOut: 'popup',
        });

        setOnrampInstance(instance);
        setIsReady(true);
      } catch (err) {
        console.error('Coinbase Pay init error:', err);
        setError(err.message);
      }
    };

    initPay();

    return () => {
      if (instance) {
        instance.destroy();
      }
    };
  }, [destinationAddress]);

  const handleClick = useCallback(() => {
    if (onrampInstance) {
      onrampInstance.open();
    }
  }, [onrampInstance]);

  if (isTestnet) {
    return null; // Don't show Coinbase Pay on testnet
  }

  if (error) {
    return (
      <p className="text-amber-400 text-xs">Coinbase Pay unavailable: {error}</p>
    );
  }

  if (!COINBASE_APP_ID) {
    return null; // Not configured
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isReady}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
      style={{ 
        background: 'linear-gradient(135deg, #0052ff 0%, #0040c9 100%)', 
        color: 'white' 
      }}
    >
      <CoinbaseIcon />
      <span>{isReady ? 'Buy with Coinbase' : 'Loading...'}</span>
    </button>
  );
}

// Coinbase logo icon
const CoinbaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="white"/>
    <path d="M16 6C10.48 6 6 10.48 6 16C6 21.52 10.48 26 16 26C21.52 26 26 21.52 26 16C26 10.48 21.52 6 16 6ZM13.5 19C12.12 19 11 17.88 11 16.5C11 15.12 12.12 14 13.5 14H18.5C19.88 14 21 15.12 21 16.5C21 17.88 19.88 19 18.5 19H13.5Z" fill="#0052FF"/>
  </svg>
);

export function OnrampCard() {
  const { address, isConnected } = useWallet();

  return (
    <div className="f10-panel p-6">
      <h3 className="text-lg font-bold text-white mb-2">Add ETH to your wallet</h3>
      <p className="text-gray-400 text-sm mb-4">
        {isTestnet 
          ? 'You need ETH to buy packs and pay gas. On Base Sepolia (testnet) you can get free ETH from a faucet.'
          : 'You need ETH on Base to buy packs. Purchase with a card or bank account via Coinbase.'
        }
      </p>
      
      <div className="flex flex-wrap gap-3">
        {/* Faucet link (always show on testnet) */}
        {isTestnet && (
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              background: 'rgba(0,229,255,0.2)', 
              border: '1px solid rgba(0,229,255,0.4)', 
              color: '#00e5ff' 
            }}
          >
            <FaucetIcon />
            <span>Get testnet ETH (Free)</span>
          </a>
        )}

        {/* Coinbase Pay (mainnet only) */}
        {!isTestnet && isConnected && address && (
          <CoinbasePayButton destinationAddress={address} />
        )}

        {/* Alternative: Direct faucet link if not connected */}
        {!isTestnet && !isConnected && (
          <p className="text-gray-400 text-sm">Connect your wallet to purchase ETH</p>
        )}
      </div>

      {/* Additional help text */}
      <div className="mt-4 text-xs text-gray-500">
        {isTestnet ? (
          <p>Testnet ETH has no real value. Switch to Base mainnet for real transactions.</p>
        ) : (
          <p>ETH on Base is used for transactions. Gas fees are typically less than $0.01.</p>
        )}
      </div>
    </div>
  );
}

// Faucet icon
const FaucetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v6m0 0a4 4 0 100 8 4 4 0 000-8zm-6 8H4m16 0h-2"/>
    <path d="M12 16v6"/>
  </svg>
);

export function NeedEthPrompt({ balance, requiredAmount }) {
  const need = requiredAmount && balance != null 
    ? (parseFloat(requiredAmount) - parseFloat(balance)).toFixed(4) 
    : null;
  
  return (
    <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/30 mb-4">
      <p className="text-amber-400 font-medium">Insufficient ETH</p>
      <p className="text-gray-400 text-sm mt-1">
        You need at least {requiredAmount} ETH. 
        {balance != null && <span> You have {parseFloat(balance).toFixed(4)} ETH.</span>}
        {need != null && parseFloat(need) > 0 && <span> Add ~{need} ETH.</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isTestnet ? (
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-cyan-400 underline"
          >
            Get testnet ETH →
          </a>
        ) : (
          <span className="text-sm text-gray-400">
            Use the "Add ETH" section above to purchase more.
          </span>
        )}
      </div>
    </div>
  );
}
