/**
 * Buy Pack – purchase NFT packs with ETH (Base Sepolia).
 * Pattern from Shop/BuyPackButton: read via wallet provider only (no public RPC/CORS),
 * clear tx states, balance check, wait for receipt.
 */
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { PACK_CONTRACT_ADDRESS, PACK_ABI, BASE_SEPOLIA_CHAIN_ID } from '../lib/contracts';

const FAUCET_URL = 'https://portal.cdp.coinbase.com/products/faucet';
const EXPLORER_TX = (hash) => `https://sepolia.basescan.org/tx/${hash}`;

const TX_STATE = {
  IDLE: 'idle',
  CONFIRMING: 'confirming',
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error',
};

export default function BuyPack({ wallet, onPurchased }) {
  const [priceWei, setPriceWei] = useState(null);
  const [saleActive, setSaleActive] = useState(true);
  const [balanceWei, setBalanceWei] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceLoadError, setPriceLoadError] = useState(null);
  const [txState, setTxState] = useState(TX_STATE.IDLE);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  // Load price + balance using wallet provider only (same as old BuyPackButton – no CORS).
  // Only runs when wallet is on Base Sepolia.
  const loadPriceAndBalance = useCallback(async () => {
    if (!wallet || typeof window === 'undefined' || !window.ethereum) return;
    setPriceLoading(true);
    setPriceLoadError(null);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const chainId = (await provider.getNetwork()).chainId;
      if (Number(chainId) !== BASE_SEPOLIA_CHAIN_ID) {
        setPriceWei(null);
        setBalanceWei(null);
        setPriceLoadError('Switch to Base Sepolia in your wallet to see price and buy.');
        return;
      }
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PACK_CONTRACT_ADDRESS, PACK_ABI, signer);
      const [price, active, balance] = await Promise.all([
        contract.packPrice(),
        contract.saleActive(),
        provider.getBalance(signer.address),
      ]);
      setPriceWei(price);
      setSaleActive(active);
      setBalanceWei(balance);
      setPriceLoadError(null);
    } catch (e) {
      setPriceWei(null);
      setBalanceWei(null);
      setPriceLoadError(e?.message || 'Failed to load price');
    } finally {
      setPriceLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (!wallet) {
      setPriceLoading(false);
      setPriceLoadError(null);
      return;
    }
    loadPriceAndBalance();
  }, [wallet, loadPriceAndBalance]);

  const handleBuy = async () => {
    setError(null);
    setTxHash(null);
    setTxState(TX_STATE.CONFIRMING);

    if (typeof window === 'undefined' || !window.ethereum) {
      setError(
        wallet
          ? 'Your wallet is linked, but this browser has no Web3 wallet (e.g. MetaMask) to sign the transaction. Open this site in a browser with MetaMask installed and connect the same address.'
          : 'No wallet detected. Install MetaMask (or another wallet) and connect in the header.'
      );
      setTxState(TX_STATE.ERROR);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const chainId = (await provider.getNetwork()).chainId;
      if (Number(chainId) !== BASE_SEPOLIA_CHAIN_ID) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` }],
        });
      }

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PACK_CONTRACT_ADDRESS, PACK_ABI, signer);
      const price = priceWei ?? (await contract.packPrice());

      if (!price || price === 0n) {
        setError('Could not get pack price. Switch to Base Sepolia and retry.');
        setTxState(TX_STATE.ERROR);
        return;
      }

      const balance = await provider.getBalance(signer.address);
      if (balance < price) {
        setError(`Insufficient balance. Need ${ethers.formatEther(price)} ETH.`);
        setTxState(TX_STATE.ERROR);
        return;
      }

      const tx = await contract.buyPack({ value: price });
      setTxHash(tx.hash);
      setTxState(TX_STATE.PENDING);

      await tx.wait();
      setTxState(TX_STATE.SUCCESS);
      if (onPurchased) onPurchased();
      loadPriceAndBalance();
    } catch (err) {
      setTxState(TX_STATE.ERROR);
      if (err?.code === 'ACTION_REJECTED') {
        setError('Transaction cancelled');
      } else if (err?.message?.toLowerCase().includes('insufficient')) {
        setError('Insufficient ETH balance');
      } else {
        const msg = err?.message || err?.toString?.() || 'Transaction failed';
        setError(msg);
      }
    }
  };

  const handleReset = () => {
    setTxState(TX_STATE.IDLE);
    setTxHash(null);
    setError(null);
  };

  if (!wallet) return null;

  const priceEth = priceWei != null ? ethers.formatEther(priceWei) : null;
  const balanceEth = balanceWei != null ? ethers.formatEther(balanceWei) : null;
  const hasEnoughBalance = balanceWei != null && priceWei != null && balanceWei >= priceWei;
  const canBuy = saleActive && txState === TX_STATE.IDLE;

  // Success state (like old BuyPackButton)
  if (txState === TX_STATE.SUCCESS) {
    return (
      <div className="mt-4 p-6 rounded-xl bg-green-900/20 border border-green-500/30 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="text-xl font-bold text-green-400 mb-2">Pack Purchased!</h3>
        <p className="text-gray-400 mb-4">Your cards are being minted...</p>
        {txHash && (
          <a href={EXPLORER_TX(txHash)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm underline block mb-3">
            View transaction →
          </a>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors"
        >
          Buy Another Pack
        </button>
      </div>
    );
  }

  // Error state (like old BuyPackButton)
  if (txState === TX_STATE.ERROR) {
    return (
      <div className="mt-4 space-y-3">
        <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-center">
          <h3 className="font-bold text-red-400 mb-2">Purchase Failed</h3>
          <p className="text-gray-400 text-sm mb-3">{error}</p>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
        <p className="text-gray-500 text-xs">
          Testnet: get free ETH from{' '}
          <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" className="underline text-cyan-400">Base Sepolia faucet</a>
        </p>
      </div>
    );
  }

  // Idle / confirming / pending
  const isProcessing = txState === TX_STATE.CONFIRMING || txState === TX_STATE.PENDING;

  return (
    <div className="mt-4 space-y-3">
      {error && (
        <p className="text-red-400 text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      <p className="text-gray-300 text-sm">
        Pack price:{' '}
        {priceLoading ? (
          <span className="text-gray-500">loading…</span>
        ) : priceEth != null ? (
          <>
            <span className="font-mono text-cyan-300">{priceEth} ETH</span>
            {!saleActive && <span className="text-amber-400 ml-2">(sale paused)</span>}
          </>
        ) : (
          <>
            <span className="text-amber-400">unavailable</span>
            {priceLoadError && <span className="text-gray-500 text-xs block mt-1">{priceLoadError}</span>}
            <button
              type="button"
              onClick={loadPriceAndBalance}
              disabled={priceLoading}
              className="mt-2 text-xs underline text-cyan-400 disabled:opacity-50 block"
            >
              {priceLoading ? 'Loading…' : 'Retry (switch to Base Sepolia first)'}
            </button>
          </>
        )}
      </p>

      {balanceEth != null && (
        <p className="text-gray-400 text-sm">
          Your balance:{' '}
          <span className={hasEnoughBalance ? 'text-green-400' : 'text-amber-400'}>{parseFloat(balanceEth).toFixed(4)} ETH</span>
          {!hasEnoughBalance && priceEth && (
            <span className="text-amber-400 text-xs block mt-1">Need at least {priceEth} ETH</span>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={handleBuy}
        disabled={!canBuy || isProcessing}
        className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
        style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.4)', color: '#00e5ff' }}
      >
        {txState === TX_STATE.CONFIRMING && 'Confirm in wallet…'}
        {txState === TX_STATE.PENDING && 'Transaction pending…'}
        {txState === TX_STATE.IDLE && (hasEnoughBalance ? 'Buy pack with ETH' : (priceWei && balanceWei != null ? 'Insufficient ETH' : 'Buy pack with ETH'))}
      </button>

      {txHash && txState === TX_STATE.PENDING && (
        <a href={EXPLORER_TX(txHash)} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-sm underline block">
          View on BaseScan →
        </a>
      )}

      <p className="text-gray-500 text-xs">
        Testnet: get free ETH from{' '}
        <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" className="underline text-cyan-400">Base Sepolia faucet</a>
      </p>
    </div>
  );
}
