# ShieldedBridge — delivery layer (MongoDB)

Encrypted **note delivery** + **global commitment index** for cross-user private
payments. The server only ever sees ciphertext + routing keys + already-public
commitments — never amounts, blindings, or spend keys.

## Run
```bash
cd backend
npm install
# put your Atlas URI in backend/.env (gitignored):
#   MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?appName=Cluster0
#   PORT=8787
npm start        # http://localhost:8787  (GET /health -> { ok, mongo })
```

## ⚠️ Atlas network access
The server logs `MongoDB connect failed (is this IP allow-listed?)` and retries
every 10s until reachable. In **Atlas → Network Access**, add an IP Access List
entry — `0.0.0.0/0` for a demo (it's a testnet DB), or your server's IP. The
endpoints return `503` until connected, then work automatically.

## API
- `GET  /health` → `{ ok, mongo }`
- `POST /address` `{ address, encPub, handle? }` — register a handle → shielded address
- `GET  /address/:handle` → `{ address, encPub }`
- `POST /notes` `{ to, ephemeralPub, nonce, ciphertext, commitment }` — deliver an encrypted note
- `GET  /notes/:to` → encrypted blobs for a recipient (they decrypt locally)
- `POST /leaves` `{ pool, leaves:[{index,commitment}] }` — append to the global tree index
- `GET  /leaves/:pool` → ordered commitments (wallets rebuild the tree to prove membership)

## Trust model
Centralized convenience: it can censor/go offline and sees delivery *metadata*
(which address received a blob, when). The decentralized upgrade is to emit the
same ciphertext on-chain from `transfer` (`ext_data`) and index leaves from chain
events — the wallet code is unchanged.
