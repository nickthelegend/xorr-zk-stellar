# Xorr — Ethereum side (Sepolia)

`ShieldedBridgeLock.sol` is the source-chain lock for the ETH → Stellar bridge.
Users lock ERC-20 USDC together with a BN254 Poseidon **note commitment**
(computed client-side, identical to the Stellar-side circuits). Each lock emits:

```solidity
event Locked(uint256 indexed nonce, uint256 amount, bytes32 commitment, address indexed from);
```

The Stellar relayer observes `Locked`, then calls `bridge_in(nonce, amount,
commitment, old_root, new_root, proof)` on the Soroban `bridge` contract, which
enforces single-use of `nonce` and mints the shielded note (proof verified
on-chain). Locked funds remain here as the on-Ethereum backing for the shielded
supply on Stellar.

## Build & deploy (Foundry)

```bash
cd eth
forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std
forge build
forge test

export SEPOLIA_RPC_URL=...   # your Sepolia RPC
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast \
  --sig "run(address)" <USDC_ERC20_ADDRESS> --private-key $PK
```

## Locking from the wallet

The client wallet computes `commitment = Poseidon(amount, Poseidon(sk), blinding)`
(the same Poseidon note scheme proven by `circuits/src/note.circom`), encodes it
big-endian into `bytes32`, then calls `lock(amount, commitment)` via MetaMask. The
returned `nonce` is what the relayer references on the Stellar side.

## Stretch: Stellar → Ethereum
The reverse direction adds a `release(...)` guarded by a proof of a burn on
Stellar (a Soroban-state proof verified here, mirroring the on-Stellar Groth16
verification). Out of scope for the MVP; the lock side is intentionally minimal so
the trust model is easy to reason about.
