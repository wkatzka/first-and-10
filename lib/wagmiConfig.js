/**
 * Wagmi configuration for Farcaster Mini App wallet integration.
 * This provides seamless wallet connection when running inside Warpcast.
 */
import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';

// Use Base Sepolia for testnet, Base for mainnet
const USE_TESTNET = true;
const activeChain = USE_TESTNET ? baseSepolia : base;

export const wagmiConfig = createConfig({
  chains: [activeChain],
  transports: {
    [activeChain.id]: http(),
  },
  connectors: [miniAppConnector()],
});

export { activeChain };
