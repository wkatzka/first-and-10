/**
 * Contract addresses and ABIs (Base Sepolia).
 * Local / testing only; crypto shop is disabled on live.
 */
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const CURRENT_NETWORK = 'baseSepolia';

const PACK_ADDRESS = process.env.NEXT_PUBLIC_PACK_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

export const PACK_CONTRACT_ADDRESS = PACK_ADDRESS;

export const PACK_ABI = [
  'function packPrice() view returns (uint256)',
  'function saleActive() view returns (bool)',
  'function buyPack() payable',
];

export function getContractAddress(name) {
  if (name === 'playerSeasonCard' || name === 'pack') return PACK_ADDRESS;
  return null;
}

export function getExplorerUrl(type, value) {
  if (type === 'tx') return `https://sepolia.basescan.org/tx/${value}`;
  if (type === 'address') return `https://sepolia.basescan.org/address/${value}`;
  return '#';
}

export const PLAYER_SEASON_CARD_ABI = PACK_ABI;
