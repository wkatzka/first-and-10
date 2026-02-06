# Local testing: Shop and pack flow

Run the app locally and test: **connect wallet → get ETH → buy pack with ETH → open pack → mint NFTs**.

## 1. Prerequisites

- Node 18+
- MetaMask (or other Web3 wallet) with **Base Sepolia** added
- (Optional) Postgres for persistent data, otherwise uses JSON file storage

## 2. Environment

**Frontend (project root)**

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_API_URL=http://localhost:4000` (points browser to your local API)

**Server (`server/`)**

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

- **`DATABASE_URL`** – Postgres connection string. If omitted, uses JSON file storage (simpler for testing).
- **`PRIVATE_KEY`** – (optional) Test wallet private key so the server can mint NFTs when a pack is bought. If omitted, pack fulfillment is disabled (you can still buy packs on-chain; they won't be fulfilled/minted until you add a key and restart).

Contract address and RPC have defaults (Base Sepolia).

## 3. Database

**Option A: JSON file (simpler)**
Comment out `DATABASE_URL` in `server/.env`. Data stored in `server/data.json`.

**Option B: Postgres**
From project root:

```bash
cd server
npm install
node db/migrate.js
node seed-dev.js
```

- `migrate.js` – creates tables (users, wallets, blockchain_packs, etc.).
- `seed-dev.js` – adds `TestUser1` / `TestUser2` to preregistered users so you can log in.

Reset a dev password if needed:

```bash
node reset-dev-password.js TestUser1
# password becomes "password"
```

## 4. Run app

From **project root** (`first-and-10/`):

```bash
npm install
npm run dev:all
```

- API: **http://localhost:4000**
- Frontend: **http://localhost:3000**

## 5. Test the shop flow

1. **Login**  
   Open http://localhost:3000 → log in as `TestUser1` / `TestUser2` (password from seed or reset).

2. **Shop**  
   Go to **Shop** in the nav.

3. **Connect wallet**  
   You'll see **Email / Social** (Web3Auth) and **MetaMask** options. Click either to connect.

4. **Get testnet ETH**  
   In the "Add ETH to your wallet" card, use the **Base Sepolia faucet** link. In the faucet, select Base Sepolia, enter your wallet address, claim ETH.

5. **Switch network**  
   In MetaMask, switch to **Base Sepolia** if not already.

6. **Buy pack**  
   Back on the Shop page you should see pack price and your balance. Click **Buy Pack**, confirm the tx in MetaMask. Wait for "Pack Purchased!" and "Your cards are being minted…".

7. **Fulfillment (if `PRIVATE_KEY` is set)**  
   The server listens for `PackPurchased` and calls `fulfillPack` to mint the 5 cards. After a short delay they appear as an NFT pack for your wallet.

8. **Open packs**  
   Go to **Packs**. In "Crypto & NFT Packs" you should see "My NFT packs" (pack from step 6). Use "Open 1 Pack" / "Open All" for in-app pack opening; cards are attributed to your account and (when fulfillment ran) minted on-chain.

## Flow summary

| Step | Where | What |
|------|--------|------|
| 1 | Shop | Connect wallet (MetaMask or Email/Social) |
| 2 | Shop / faucet link | Get testnet ETH |
| 3 | Shop | Buy pack with ETH (`buyPack()` on contract) |
| 4 | Server | Pack fulfillment listens for `PackPurchased`, mints 5 cards |
| 5 | Packs page | Open pack(s), view and own NFT cards |

## Web3Auth (Email / Social login)

The app supports Web3Auth for email/social login (Google, Twitter, Discord, etc.) in addition to MetaMask.

**Setup:**

1. Create a project at [Web3Auth Dashboard](https://dashboard.web3auth.io)
2. Copy the **Client ID**
3. In the dashboard → **Plug and Play** → add allowed domains:
   - `http://localhost:3000` (for local dev)
   - Your production domain when deploying
4. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_client_id_here
   ```
5. Restart the dev server

The Shop page will show both **Email / Social** and **MetaMask** connect options.

## Coinbase Pay (Buy ETH - Mainnet only)

For mainnet deployment, users can buy ETH directly via Coinbase Pay:

1. Register at [Coinbase Pay Onramp](https://pay.coinbase.com/onramp)
2. Get your **App ID**
3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_COINBASE_APP_ID=your_app_id_here
   ```

Note: Coinbase Pay only works on mainnet. For testnet (Base Sepolia), users get free ETH from the faucet.

## Troubleshooting

- **"Could not load pack price"** – Wallet must be on **Base Sepolia**; switch in MetaMask and retry.
- **Pack bought but no cards** – Ensure `PRIVATE_KEY` is set in `server/.env` and server was restarted; check server logs for pack-fulfillment errors.
- **API / DB errors** – Confirm `DATABASE_URL` and that migrations + seed ran; use `node reset-dev-password.js TestUser1` if login fails.
- **"Wallet is not ready yet, failed to fetch project configurations"** – Web3Auth cannot load your project config. Check that `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` in `.env.local` matches your [Web3Auth Dashboard](https://dashboard.web3auth.io) project, and that the project's Plug and Play settings (e.g. allowed origins) include your app URL. Use **MetaMask** to connect in the meantime.
