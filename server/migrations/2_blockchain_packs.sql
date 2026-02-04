-- Migration 2: Blockchain pack tracking (idempotent)
-- Tables already exist in your DB; this is for fresh installs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blockchain_packs') THEN
    CREATE TABLE blockchain_packs (
      id SERIAL PRIMARY KEY,
      pack_id INTEGER NOT NULL,
      chain_id INTEGER NOT NULL DEFAULT 84532,
      contract_address VARCHAR(42) NOT NULL,
      buyer_wallet VARCHAR(42) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      tx_hash VARCHAR(66) NOT NULL,
      block_number BIGINT NOT NULL,
      price_wei VARCHAR(78),
      status VARCHAR(20) DEFAULT 'purchased',
      fulfilled_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(chain_id, contract_address, pack_id)
    );
    CREATE INDEX idx_blockchain_packs_buyer ON blockchain_packs(buyer_wallet);
    CREATE INDEX idx_blockchain_packs_user_id ON blockchain_packs(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blockchain_pack_cards') THEN
    CREATE TABLE blockchain_pack_cards (
      id SERIAL PRIMARY KEY,
      pack_id INTEGER NOT NULL REFERENCES blockchain_packs(id) ON DELETE CASCADE,
      token_id INTEGER NOT NULL,
      player_key VARCHAR(200) NOT NULL,
      player_name VARCHAR(200) NOT NULL,
      season INTEGER NOT NULL,
      position VARCHAR(10),
      tier INTEGER,
      card_id INTEGER REFERENCES cards(id),
      mint_tx_hash VARCHAR(66),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blockchain_sync_state') THEN
    CREATE TABLE blockchain_sync_state (
      id SERIAL PRIMARY KEY,
      chain_id INTEGER NOT NULL,
      contract_address VARCHAR(42) NOT NULL,
      last_block BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(chain_id, contract_address)
    );
  END IF;
END $$;
