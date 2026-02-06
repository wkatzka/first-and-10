/**
 * Farcaster Mini App Wallet Context using Wagmi.
 * Provides seamless wallet integration when running inside Warpcast.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { WagmiProvider, useAccount, useConnect, useDisconnect, useBalance, usePublicClient, useWalletClient } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserProvider } from 'ethers';
import { wagmiConfig, activeChain } from './wagmiConfig';
import { initFarcasterSDK, getFarcasterContext } from './farcaster';
import { BASE_SEPOLIA_CHAIN_ID } from './contracts';

// Create a query client for react-query (required by wagmi)
const queryClient = new QueryClient();

// Inner context for wallet state
const FarcasterWalletInnerContext = createContext(null);

function FarcasterWalletInner({ children }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address, chainId: activeChain.id });
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [farcasterUser, setFarcasterUser] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [ethersProvider, setEthersProvider] = useState(null);

  // Initialize SDK when component mounts
  useEffect(() => {
    const init = async () => {
      const sdk = await initFarcasterSDK();
      if (sdk) {
        setSdkReady(true);
        
        // Get Farcaster user context
        const context = await getFarcasterContext();
        if (context?.user) {
          setFarcasterUser(context.user);
        }
      }
    };
    init();
  }, []);

  // Create ethers provider when wallet client is available
  useEffect(() => {
    if (walletClient) {
      // Create an ethers provider from wagmi's wallet client
      // This allows us to use ethers.Contract with wagmi's signer
      const provider = new BrowserProvider(walletClient.transport, {
        chainId: activeChain.id,
        name: activeChain.name,
      });
      setEthersProvider(provider);
    }
  }, [walletClient]);

  // Auto-connect to wallet if available
  useEffect(() => {
    if (sdkReady && !isConnected && connectors.length > 0) {
      // Farcaster connector auto-connects if user has a wallet
      connect({ connector: connectors[0] });
    }
  }, [sdkReady, isConnected, connect, connectors]);

  // Check if on correct network (Base Sepolia)
  const isCorrectNetwork = chainId === BASE_SEPOLIA_CHAIN_ID;

  // Connect wallet
  const connectWallet = async () => {
    if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  };

  // Disconnect wallet
  const disconnect = async () => {
    wagmiDisconnect();
  };

  // Get ethers-compatible signer for contract interactions
  const getSigner = useCallback(async () => {
    if (!isConnected || !address || !ethersProvider) return null;
    
    try {
      const signer = await ethersProvider.getSigner();
      return signer;
    } catch (error) {
      console.error('[Farcaster] getSigner error:', error);
      return null;
    }
  }, [isConnected, address, ethersProvider]);

  // Network switch (in Farcaster, this is generally handled automatically)
  const switchNetwork = async () => {
    // In Farcaster Mini Apps, the wallet is typically already on the correct network
    // Show guidance if not
    if (!isCorrectNetwork) {
      alert('Please switch to Base Sepolia in your wallet settings.');
    }
  };

  const value = {
    // Wallet state
    address,
    isConnected,
    chainId,
    balance: balanceData?.formatted || '0',
    balanceSymbol: balanceData?.symbol || 'ETH',
    
    // Network
    isCorrectNetwork,
    switchNetwork,
    
    // Farcaster-specific
    farcasterUser,
    sdkReady,
    isFarcaster: true,
    
    // Actions
    connect: connectWallet,
    disconnect,
    getSigner,
    
    // Compatibility with existing code
    provider: ethersProvider,
    walletType: 'farcaster',
    isInitializing: !sdkReady,
    web3authReady: false,
    connectWeb3Auth: null,
    connectMetaMask: null,
  };

  return (
    <FarcasterWalletInnerContext.Provider value={value}>
      {children}
    </FarcasterWalletInnerContext.Provider>
  );
}

// Main provider that wraps Wagmi
export function FarcasterWalletProvider({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <FarcasterWalletInner>
          {children}
        </FarcasterWalletInner>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Hook to access wallet context
// Returns null if not in a FarcasterWalletProvider (safe to call anywhere)
export function useFarcasterWallet() {
  const ctx = useContext(FarcasterWalletInnerContext);
  return ctx;
}
