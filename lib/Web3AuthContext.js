/**
 * Wallet context (MetaMask / injected). Used only when cryptoShopEnabled (local).
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { BASE_SEPOLIA_CHAIN_ID } from './contracts';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('No wallet found. Install MetaMask.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const prov = new ethers.BrowserProvider(window.ethereum);
      const network = await prov.getNetwork();
      setProvider(prov);
      setAddress(accounts[0] || null);
      setChainId(Number(network.chainId));
    } catch (e) {
      console.error('Wallet connect:', e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    const load = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts?.[0]) {
          const prov = new ethers.BrowserProvider(window.ethereum);
          const network = await prov.getNetwork();
          setProvider(prov);
          setAddress(accounts[0]);
          setChainId(Number(network.chainId));
        }
      } catch (_) {}
    };
    load();
    const onAccounts = () => load();
    const onChain = () => load();
    window.ethereum.on?.('accountsChanged', onAccounts);
    window.ethereum.on?.('chainChanged', onChain);
    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAccounts);
      window.ethereum.removeListener?.('chainChanged', onChain);
    };
  }, []);

  const value = {
    address,
    isConnected: !!address,
    chainId,
    provider,
    connect,
    disconnect: () => {
      setProvider(null);
      setAddress(null);
      setChainId(null);
    },
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
