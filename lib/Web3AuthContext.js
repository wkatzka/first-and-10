/**
 * Wallet context with Web3Auth v10 (Email/Social) + MetaMask support.
 * Used only when cryptoShopEnabled (local/testing).
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { BASE_SEPOLIA_CHAIN_ID } from './contracts';

const WalletContext = createContext(null);

// Web3Auth config
const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || '';

// Base Sepolia chain config for Web3Auth
const chainConfig = {
  chainNamespace: 'eip155',
  chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16), // 0x14a34
  rpcTarget: 'https://sepolia.base.org',
  displayName: 'Base Sepolia',
  blockExplorerUrl: 'https://sepolia.basescan.org',
  ticker: 'ETH',
  tickerName: 'Ethereum',
};

export function WalletProvider({ children }) {
  const [web3auth, setWeb3auth] = useState(null);
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [walletType, setWalletType] = useState(null); // 'web3auth' | 'injected'
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);
  const initRef = useRef(false);

  // Initialize Web3Auth
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      if (!WEB3AUTH_CLIENT_ID) {
        console.log('Web3Auth: No client ID configured, MetaMask only mode');
        setIsInitializing(false);
        return;
      }

      try {
        // Dynamic import to avoid SSR issues
        const { Web3Auth } = await import('@web3auth/modal');
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import('@web3auth/base');
        const { EthereumPrivateKeyProvider } = await import('@web3auth/ethereum-provider');

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { 
            chainConfig: {
              chainNamespace: CHAIN_NAMESPACES.EIP155,
              chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16),
              rpcTarget: 'https://sepolia.base.org',
              displayName: 'Base Sepolia',
              blockExplorerUrl: 'https://sepolia.basescan.org',
              ticker: 'ETH',
              tickerName: 'Ethereum',
            }
          },
        });

        const web3authInstance = new Web3Auth({
          clientId: WEB3AUTH_CLIENT_ID,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          privateKeyProvider,
        });

        await web3authInstance.init();
        setWeb3auth(web3authInstance);

        // Check if already connected
        if (web3authInstance.connected && web3authInstance.provider) {
          const ethersProvider = new ethers.BrowserProvider(web3authInstance.provider);
          const signer = await ethersProvider.getSigner();
          const addr = await signer.getAddress();
          const network = await ethersProvider.getNetwork();
          
          setProvider(ethersProvider);
          setAddress(addr);
          setChainId(Number(network.chainId));
          setWalletType('web3auth');
        }
      } catch (error) {
        console.error('Web3Auth init error:', error);
        setInitError(error.message);
      }
      
      // Also check if MetaMask is already connected (even if Web3Auth fails)
      await checkMetaMaskConnection();
      setIsInitializing(false);
    };

    const checkMetaMaskConnection = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;
      
      try {
        // Check if already connected (without prompting)
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          const ethersProvider = new ethers.BrowserProvider(window.ethereum);
          const network = await ethersProvider.getNetwork();
          
          setProvider(ethersProvider);
          setAddress(accounts[0]);
          setChainId(Number(network.chainId));
          setWalletType('injected');
          console.log('MetaMask auto-reconnected:', accounts[0]);
        }
      } catch (err) {
        console.log('MetaMask auto-connect check failed:', err);
      }
    };

    init();
  }, []);

  // Connect with Web3Auth (Email/Social)
  const connectWeb3Auth = useCallback(async () => {
    if (!web3auth) {
      alert('Web3Auth not initialized. Try MetaMask instead.');
      return;
    }
    try {
      const web3authProvider = await web3auth.connect();
      if (web3authProvider) {
        const ethersProvider = new ethers.BrowserProvider(web3authProvider);
        const signer = await ethersProvider.getSigner();
        const addr = await signer.getAddress();
        const network = await ethersProvider.getNetwork();
        
        setProvider(ethersProvider);
        setAddress(addr);
        setChainId(Number(network.chainId));
        setWalletType('web3auth');
      }
    } catch (error) {
      console.error('Web3Auth connect error:', error);
      if (error.message?.includes('User closed')) {
        // User cancelled, ignore
      } else {
        alert('Failed to connect: ' + error.message);
      }
    }
  }, [web3auth]);

  // Connect with MetaMask (injected)
  const connectMetaMask = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask not found. Install MetaMask or use Email/Social login.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const network = await ethersProvider.getNetwork();
      
      setProvider(ethersProvider);
      setAddress(accounts[0] || null);
      setChainId(Number(network.chainId));
      setWalletType('injected');
    } catch (error) {
      console.error('MetaMask connect error:', error);
    }
  }, []);

  // Generic connect (shows Web3Auth modal with all options)
  const connect = useCallback(async () => {
    if (web3auth) {
      await connectWeb3Auth();
    } else {
      await connectMetaMask();
    }
  }, [web3auth, connectWeb3Auth, connectMetaMask]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      if (walletType === 'web3auth' && web3auth?.connected) {
        await web3auth.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    setProvider(null);
    setAddress(null);
    setChainId(null);
    setWalletType(null);
  }, [web3auth, walletType]);

  // Listen for MetaMask account/chain changes when using injected
  useEffect(() => {
    if (walletType !== 'injected' || typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = async () => {
      if (window.ethereum) {
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);
        const network = await ethersProvider.getNetwork();
        setProvider(ethersProvider);
        setChainId(Number(network.chainId));
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [walletType, disconnect]);

  const value = {
    address,
    isConnected: !!address,
    chainId,
    provider,
    walletType,
    isInitializing,
    initError,
    web3authReady: !!web3auth,
    connect,
    connectWeb3Auth,
    connectMetaMask,
    disconnect,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  return useContext(WalletContext);
}
