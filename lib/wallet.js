/**
 * useWallet – for Shop (local only). Reads from Web3AuthContext.
 */
import { useCallback } from 'react';
import { ethers } from 'ethers';
import { BASE_SEPOLIA_CHAIN_ID } from './contracts';
import { useWalletContext } from './Web3AuthContext';

export function useWallet() {
  const ctx = useWalletContext();
  const address = ctx?.address ?? null;
  const isConnected = !!address;

  const getSigner = useCallback(async () => {
    if (!ctx?.provider) return null;
    try {
      const signer = await ctx.provider.getSigner();
      const network = await ctx.provider.getNetwork();
      if (Number(network.chainId) !== BASE_SEPOLIA_CHAIN_ID) return null;
      return signer;
    } catch {
      return null;
    }
  }, [ctx?.provider]);

  return {
    address,
    isConnected,
    getSigner,
    chainId: ctx?.chainId,
    connect: ctx?.connect,
    disconnect: ctx?.disconnect,
  };
}
