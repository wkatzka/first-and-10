/**
 * Buy Pack Button (Shop) – purchase NFT packs with ETH.
 * Uses useWallet() for signer/balance; same pattern as old Shop.
 */
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../lib/wallet';
import {
  getContractAddress,
  getExplorerUrl,
  PLAYER_SEASON_CARD_ABI,
  CURRENT_NETWORK,
} from '../lib/contracts';
import { NeedEthPrompt } from './CoinbaseOnramp';

const TX_STATE = {
  IDLE: 'idle',
  CONFIRMING: 'confirming',
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error',
};

export function BuyPackButton({ onSuccess, className = '' }) {
  const { address, isConnected, getSigner } = useWallet();
  const [txState, setTxState] = useState(TX_STATE.IDLE);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [packPrice, setPackPrice] = useState(null);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!isConnected) return;

    const loadData = async () => {
      try {
        const signer = await getSigner();
        if (!signer) return;

        const provider = signer.provider;
        const contractAddress = getContractAddress('playerSeasonCard');

        if (!contractAddress) {
          console.log('No contract address configured');
          return;
        }

        const contract = new ethers.Contract(
          contractAddress,
          PLAYER_SEASON_CARD_ABI,
          provider
        );

        const price = await contract.packPrice();
        setPackPrice(ethers.formatEther(price));

        const bal = await provider.getBalance(address);
        setBalance(ethers.formatEther(bal));
      } catch (err) {
        console.error('Error loading pack data:', err);
      }
    };

    loadData();
  }, [isConnected, address, getSigner]);

  const handleBuyPack = useCallback(async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    const contractAddress = getContractAddress('playerSeasonCard');
    if (!contractAddress) {
      setError('Contract not deployed on this network');
      return;
    }

    setTxState(TX_STATE.CONFIRMING);
    setError(null);
    setTxHash(null);

    try {
      const signer = await getSigner();
      if (!signer) {
        throw new Error('Could not get signer');
      }

      const contract = new ethers.Contract(
        contractAddress,
        PLAYER_SEASON_CARD_ABI,
        signer
      );

      const price = await contract.packPrice();

      const balanceWei = await signer.provider.getBalance(address);
      if (balanceWei < price) {
        throw new Error(`Insufficient balance. Need ${ethers.formatEther(price)} ETH`);
      }

      setTxState(TX_STATE.CONFIRMING);
      const tx = await contract.buyPack({ value: price });

      setTxHash(tx.hash);
      setTxState(TX_STATE.PENDING);

      const receipt = await tx.wait();

      setTxState(TX_STATE.SUCCESS);

      if (onSuccess) {
        onSuccess({
          txHash: tx.hash,
          receipt,
        });
      }

      const newBal = await signer.provider.getBalance(address);
      setBalance(ethers.formatEther(newBal));
    } catch (err) {
      console.error('Purchase error:', err);
      setTxState(TX_STATE.ERROR);

      if (err.code === 'ACTION_REJECTED') {
        setError('Transaction cancelled');
      } else if (err.message?.includes('insufficient')) {
        setError('Insufficient ETH balance');
      } else {
        setError(err.message || 'Transaction failed');
      }
    }
  }, [isConnected, address, getSigner, onSuccess]);

  const handleReset = () => {
    setTxState(TX_STATE.IDLE);
    setTxHash(null);
    setError(null);
  };

  if (!isConnected) {
    return (
      <div className="text-gray-400 text-center p-4">
        Connect your wallet to buy packs
      </div>
    );
  }

  if (txState === TX_STATE.SUCCESS) {
    return (
      <div className="p-6 rounded-xl bg-green-900/20 border border-green-500/30 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-xl font-bold text-green-400 mb-2">Pack Purchased!</h3>
        <p className="text-gray-400 mb-4">Your cards are being minted...</p>
        {txHash && (
          <a
            href={getExplorerUrl('tx', txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            View transaction →
          </a>
        )}
        <button
          onClick={handleReset}
          className="mt-4 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors"
        >
          Buy Another Pack
        </button>
      </div>
    );
  }

  if (txState === TX_STATE.ERROR) {
    return (
      <div className="p-6 rounded-xl bg-red-900/20 border border-red-500/30 text-center">
        <div className="text-4xl mb-3">❌</div>
        <h3 className="text-xl font-bold text-red-400 mb-2">Purchase Failed</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isProcessing = txState === TX_STATE.CONFIRMING || txState === TX_STATE.PENDING;
  const hasEnoughBalance = balance && packPrice && parseFloat(balance) >= parseFloat(packPrice);

  return (
    <div className={className}>
      {!hasEnoughBalance && packPrice && (
        <NeedEthPrompt balance={balance} requiredAmount={packPrice} />
      )}

      <div className="p-6 rounded-xl bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 mt-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-5xl">📦</div>
          <div>
            <h3 className="text-xl font-bold text-white">Card Pack</h3>
            <p className="text-gray-400">5 random player cards</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-black/30">
          <span className="text-gray-400">Price</span>
          <span className="text-xl font-bold text-white">
            {packPrice ? `${packPrice} ETH` : 'Loading...'}
          </span>
        </div>

        {balance && (
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="text-gray-500">Your balance</span>
            <span className={`font-mono ${hasEnoughBalance ? 'text-green-400' : 'text-red-400'}`}>
              {parseFloat(balance).toFixed(6)} ETH
            </span>
          </div>
        )}

        <button
          onClick={handleBuyPack}
          disabled={isProcessing || !hasEnoughBalance}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            isProcessing
              ? 'bg-gray-700 text-gray-400 cursor-wait'
              : hasEnoughBalance
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {txState === TX_STATE.CONFIRMING && '⏳ Confirm in wallet...'}
          {txState === TX_STATE.PENDING && '⏳ Transaction pending...'}
          {txState === TX_STATE.IDLE && (hasEnoughBalance ? '🛒 Buy Pack' : 'Insufficient ETH')}
        </button>

        {txHash && txState === TX_STATE.PENDING && (
          <a
            href={getExplorerUrl('tx', txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-blue-400 hover:text-blue-300 text-sm mt-3 underline"
          >
            View on BaseScan →
          </a>
        )}
      </div>

      <p className="text-gray-500 text-xs text-center mt-3">
        Network: {CURRENT_NETWORK === 'baseSepolia' ? 'Base Sepolia (Testnet)' : 'Base'}
      </p>
    </div>
  );
}

export default BuyPackButton;
