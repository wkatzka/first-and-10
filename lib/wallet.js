/**
 * useWallet – for Shop (local only). Reads from Web3AuthContext.
 */
import { useCallback } from 'react';
import { BASE_SEPOLIA_CHAIN_ID } from './contracts';
import { useWalletContext } from './Web3AuthContext';

export function useWallet() {
  const ctx = useWalletContext();
  const address = ctx?.address ?? null;
  const isConnected = !!address;

  // Get signer - works on any network (for reading balance)
  const getSigner = useCallback(async () => {
    if (!ctx?.provider) return null;
    try {
      const signer = await ctx.provider.getSigner();
      return signer;
    } catch {
      return null;
    }
  }, [ctx?.provider]);

  // Check if on correct network
  const isCorrectNetwork = ctx?.chainId === BASE_SEPOLIA_CHAIN_ID;

  // Switch to Base Sepolia network
  const switchNetwork = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16) }],
      });
    } catch (switchError) {
      // Chain not added, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16),
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org'],
            }],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
        }
      }
    }
  }, []);

  return {
    address,
    isConnected,
    getSigner,
    chainId: ctx?.chainId,
    isCorrectNetwork,
    walletType: ctx?.walletType,
    isInitializing: ctx?.isInitializing,
    connect: ctx?.connect,
    connectWeb3Auth: ctx?.connectWeb3Auth,
    connectMetaMask: ctx?.connectMetaMask,
    disconnect: ctx?.disconnect,
    switchNetwork,
  };
}
