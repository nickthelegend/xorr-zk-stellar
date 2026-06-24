// Network + deployed-contract configuration. Populate the VITE_* vars in
// `.env.local` after running `scripts/deploy_testnet.sh` (which writes them for
// you). Defaults target Stellar Testnet.
export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK ?? "testnet";

export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

export const POOL_ID = import.meta.env.VITE_POOL_ID ?? "";
export const BRIDGE_ID = import.meta.env.VITE_BRIDGE_ID ?? "";
export const VERIFIER_ID = import.meta.env.VITE_VERIFIER_ID ?? "";
export const TOKEN_ID = import.meta.env.VITE_TOKEN_ID ?? "";

export const TREE_DEPTH = Number(import.meta.env.VITE_TREE_DEPTH ?? "20");

// Encrypted note-delivery + global-leaf indexer (MongoDB-backed). Empty = the
// wallet runs in single-user mode (own notes only, no cross-user send/receive).
// Default to the same-origin Vite proxy ("/api" -> localhost:8787), which works
// both locally and in Codespaces (no exposed backend port / no CORS). Override
// with VITE_DELIVERY_URL for a separately-hosted backend in production.
export const DELIVERY_URL = import.meta.env.VITE_DELIVERY_URL ?? "/api";

export function deliveryEnabled(): boolean {
  return Boolean(DELIVERY_URL);
}

// --- Ethereum (Sepolia) side of the bridge ---
export const SEPOLIA_RPC = import.meta.env.VITE_SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
export const ETH_LOCK = import.meta.env.VITE_ETH_LOCK ?? "0x3E48BDF44BD676D3F8cCb796138bBDcDA17e4F25";
export const USDC_ISSUER = import.meta.env.VITE_USDC_ISSUER ?? "GB6247QGRVBOIIIDRYAOEP23FKXBKLLPIDXFXSQPM7A7XGYDVHFC73Z3";

// Decimals for the shielded asset (USDC = 7 on Stellar).
export const ASSET_DECIMALS = 7;
export const ASSET_SYMBOL = "USDC";

export function isConfigured(): boolean {
  return Boolean(POOL_ID && TOKEN_ID);
}
