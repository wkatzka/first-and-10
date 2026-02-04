-- Migration 3: Wallets (link user accounts to wallet addresses for NFT pack attribution)
-- Idempotent - safe if already applied.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets') THEN
    CREATE TABLE wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      address VARCHAR(42) NOT NULL,
      wallet_type VARCHAR(20) DEFAULT 'external',
      chain_id INTEGER NOT NULL DEFAULT 84532,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_wallets_address ON wallets(LOWER(address));
  END IF;
END $$;
