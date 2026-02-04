/**
 * OnrampCard – link to add ETH (testnet faucet or buy).
 * NeedEthPrompt – show when user doesn't have enough balance.
 */
const FAUCET_URL = 'https://portal.cdp.coinbase.com/products/faucet';

export function OnrampCard() {
  return (
    <div className="f10-panel p-6">
      <h3 className="text-lg font-bold text-white mb-2">Add ETH to your wallet</h3>
      <p className="text-gray-400 text-sm mb-4">
        You need ETH to buy packs and pay gas. On Base Sepolia (testnet) you can get free ETH from a faucet.
      </p>
      <a
        href={FAUCET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-lg font-medium transition-colors"
        style={{ background: 'rgba(0,229,255,0.2)', border: '1px solid rgba(0,229,255,0.4)', color: '#00e5ff' }}
      >
        Get testnet ETH (Base Sepolia faucet) →
      </a>
    </div>
  );
}

export function NeedEthPrompt({ balance, requiredAmount }) {
  const need = requiredAmount && balance != null ? (parseFloat(requiredAmount) - parseFloat(balance)).toFixed(4) : null;
  return (
    <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/30 mb-4">
      <p className="text-amber-400 font-medium">Insufficient ETH</p>
      <p className="text-gray-400 text-sm mt-1">
        You need at least {requiredAmount} ETH. {balance != null && <span>You have {parseFloat(balance).toFixed(4)} ETH.</span>}
        {need != null && parseFloat(need) > 0 && <span> Add ~{need} ETH.</span>}
      </p>
      <a
        href={FAUCET_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-2 text-sm text-cyan-400 underline"
      >
        Get testnet ETH →
      </a>
    </div>
  );
}
