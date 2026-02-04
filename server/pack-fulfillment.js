/**
 * Pack Fulfillment Service
 * ========================
 * Listens for PackPurchased events and fulfills packs by minting NFTs
 */

const { ethers } = require('ethers');
const db = require('./db');
const packs = require('./packs');
const mintingLedger = require('./minting-ledger');
const database = require('./database');

const CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || '0x7Dc1a1e4240248B77BcE32DbFb39aB1b2b8007B3';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '84532');
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const CONTRACT_ABI = [
  'event PackPurchased(address indexed buyer, uint256 packId, uint256[] tokenIds, uint256 price)',
  'event CardMinted(uint256 indexed tokenId, address to, string playerId, uint16 season)',
  'function fulfillPack(address to, string[] calldata playerIds, uint16[] calldata seasons) external',
  'function cardsPerPack() view returns (uint256)',
  'function totalPacksSold() view returns (uint256)',
];

let provider = null;
let wallet = null;
let contract = null;
let isRunning = false;

async function initialize() {
  if (!process.env.PRIVATE_KEY) {
    console.warn('PRIVATE_KEY not set - pack fulfillment disabled');
    return false;
  }
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    console.log('Pack fulfillment initialized:', CONTRACT_ADDRESS);
    return true;
  } catch (err) {
    console.error('Pack fulfillment init failed:', err);
    return false;
  }
}

async function getLastProcessedBlock() {
  const result = await db.query(
    'SELECT last_block FROM blockchain_sync_state WHERE chain_id = $1 AND contract_address = $2',
    [CHAIN_ID, CONTRACT_ADDRESS.toLowerCase()]
  );
  if (result.rows.length > 0) return parseInt(result.rows[0].last_block);
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, currentBlock - 1000);
  await db.query(
    'INSERT INTO blockchain_sync_state (chain_id, contract_address, last_block) VALUES ($1, $2, $3) ON CONFLICT (chain_id, contract_address) DO UPDATE SET last_block = $3',
    [CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), startBlock]
  );
  return startBlock;
}

async function updateLastProcessedBlock(blockNumber) {
  await db.query(
    'UPDATE blockchain_sync_state SET last_block = $1, updated_at = NOW() WHERE chain_id = $2 AND contract_address = $3',
    [blockNumber, CHAIN_ID, CONTRACT_ADDRESS.toLowerCase()]
  );
}

function getPlayersByTier() {
  const allPlayers = packs.loadPlayers();
  const byTier = {};
  for (let i = 1; i <= 11; i++) byTier[i] = [];
  for (const p of allPlayers) {
    const t = p.tier || 1;
    if (byTier[t]) byTier[t].push(p);
  }
  return byTier;
}

function pickRandomFromTier(tier) {
  const byTier = getPlayersByTier();
  const arr = byTier[tier];
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function selectCardsForPack(userId) {
  const allPlayers = packs.loadPlayers();
  const cards = [];
  for (let i = 0; i < 5; i++) {
    const tier = packs.pickRandomTier();
    let player = null;
    for (let attempt = 0; attempt < 100 && !player; attempt++) {
      const c = pickRandomFromTier(tier);
      if (c && !(await mintingLedger.isCardMinted(c))) player = c;
    }
    if (!player) {
      const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
      for (const c of shuffled.slice(0, 500)) {
        if (!(await mintingLedger.isCardMinted(c))) { player = c; break; }
      }
    }
    if (player) cards.push({ ...player, pack_position: i + 1 });
  }
  return cards;
}

async function processPackPurchase(event) {
  const { buyer, packId, price } = event.args;
  const txHash = event.transactionHash;
  const blockNumber = event.blockNumber;

  const existing = await db.query(
    'SELECT id, status FROM blockchain_packs WHERE chain_id = $1 AND contract_address = $2 AND pack_id = $3',
    [CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), packId.toString()]
  );

  if (existing.rows.length > 0 && existing.rows[0].status !== 'purchased') return;

  const walletRow = await database.getWalletByAddress(buyer);
  const userId = walletRow?.user_id || null;

  if (existing.rows.length === 0) {
    await db.query(
      `INSERT INTO blockchain_packs (pack_id, chain_id, contract_address, buyer_wallet, user_id, tx_hash, block_number, price_wei, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'purchased')`,
      [packId.toString(), CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), buyer, userId, txHash, blockNumber, price.toString()]
    );
  }

  const cards = await selectCardsForPack(userId);
  if (cards.length < 5) {
    await db.query('UPDATE blockchain_packs SET status = $1 WHERE chain_id = $2 AND contract_address = $3 AND pack_id = $4', ['failed', CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), packId.toString()]);
    return;
  }

  const playerIds = cards.map(c => `${c.player}_${c.season}`);
  const seasons = cards.map(c => c.season);

  try {
    const tx = await contract.fulfillPack(buyer, playerIds, seasons);
    const receipt = await tx.wait();
    const tokenIds = [];
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === 'CardMinted') tokenIds.push(parsed.args.tokenId.toString());
      } catch (_) {}
    }

    const packResult = await db.query('SELECT id FROM blockchain_packs WHERE chain_id = $1 AND contract_address = $2 AND pack_id = $3', [CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), packId.toString()]);
    const dbPackId = packResult.rows[0].id;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      try { await mintingLedger.mintCard(card, userId); } catch (e) {}
      const tokenId = tokenIds[i] || (i + 1);
      await db.query(
        `INSERT INTO blockchain_pack_cards (pack_id, token_id, player_key, player_name, season, position, tier, mint_tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [dbPackId, tokenId, `${(card.player || '').toLowerCase().trim()}_${card.season}`, card.player, card.season, card.position, card.tier, tx.hash]
      );
    }

    await db.query('UPDATE blockchain_packs SET status = $1, fulfilled_at = NOW() WHERE id = $2', ['fulfilled', dbPackId]);
    console.log('Pack #' + packId + ' fulfilled');
  } catch (err) {
    console.error('Fulfill failed:', err.message);
    await db.query('UPDATE blockchain_packs SET status = $1 WHERE chain_id = $2 AND contract_address = $3 AND pack_id = $4', ['failed', CHAIN_ID, CONTRACT_ADDRESS.toLowerCase(), packId.toString()]);
  }
}

async function pollForEvents() {
  if (!contract || isRunning) return;
  isRunning = true;
  try {
    let fromBlock = await getLastProcessedBlock();
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= fromBlock) { isRunning = false; return; }
    const chunkSize = 2000;
    for (let start = fromBlock + 1; start <= currentBlock; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, currentBlock);
      const events = await contract.queryFilter(contract.filters.PackPurchased(), start, end);
      for (const e of events) await processPackPurchase(e);
      await updateLastProcessedBlock(end);
    }
  } catch (err) { console.error('Poll error:', err); }
  isRunning = false;
}

async function start(intervalMs = 15000) {
  if (!(await initialize())) return;
  await pollForEvents();
  setInterval(pollForEvents, intervalMs);
}

async function getPackStatus(packId) {
  const result = await db.query(
    `SELECT bp.*, json_agg(json_build_object('token_id', bpc.token_id, 'player_name', bpc.player_name, 'season', bpc.season, 'position', bpc.position, 'tier', bpc.tier)) FILTER (WHERE bpc.id IS NOT NULL) as cards
     FROM blockchain_packs bp LEFT JOIN blockchain_pack_cards bpc ON bpc.pack_id = bp.id
     WHERE bp.pack_id = $1 AND bp.chain_id = $2 AND bp.contract_address = $3 GROUP BY bp.id`,
    [packId, CHAIN_ID, CONTRACT_ADDRESS.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function getPacksForWallet(walletAddress) {
  const result = await db.query(
    `SELECT bp.*, json_agg(json_build_object('token_id', bpc.token_id, 'player_name', bpc.player_name, 'season', bpc.season, 'position', bpc.position, 'tier', bpc.tier)) FILTER (WHERE bpc.id IS NOT NULL) as cards
     FROM blockchain_packs bp LEFT JOIN blockchain_pack_cards bpc ON bpc.pack_id = bp.id
     WHERE LOWER(bp.buyer_wallet) = LOWER($1) GROUP BY bp.id ORDER BY bp.created_at DESC`,
    [walletAddress]
  );
  return result.rows;
}

module.exports = { initialize, start, pollForEvents, getPackStatus, getPacksForWallet, CONTRACT_ADDRESS, CHAIN_ID };
