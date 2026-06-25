// Network + deployed-contract configuration. Populate the NEXT_PUBLIC_* vars in
// `.env.local` after running `scripts/deploy_testnet.sh` (which writes them for
// you). Defaults target Stellar Testnet.
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

// Defaults point at the live Xorr testnet deployment (deployed under our own
// `xorr` key, 2026-06-21) so the wallet is configured out of the box; override
// any of these via NEXT_PUBLIC_* env vars (scripts/deploy_xorr.sh writes them).
// ZK-swap pool (privacy-pool build with `private_swap`, wired to the AMM venue).
export const POOL_ID = process.env.NEXT_PUBLIC_POOL_ID ?? "CA5T3ZM6EFLSOFI5ZAWMN3CZV6U5I2BCCH2W6JSXNYCH3CVRG4BVFZ65";
// Bridge we control (admin+relayer=xorr), mints into POOL_ID; funded with USDC.
// v2: also verifies ETH deposit-tree membership against a relayer-posted root.
export const BRIDGE_ID = process.env.NEXT_PUBLIC_BRIDGE_ID ?? "CBTSR6QKVGVTJ2NTJABVAETXZIV7H5UZG745L4G6UZNHZIURIMLCHGGL";
export const VERIFIER_ID = process.env.NEXT_PUBLIC_VERIFIER_ID ?? "CC46C65SFSA2QNNGZRRXAYTDB4S6V4MB52MGDBZC5A6NI3QG5H4L2FO2";
export const TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_ID ?? "CAD7OEAESCGR5XV2BA2AHZCWM6EVJEYBYOOCA3D3ZG4TCOBWWHMZVFIV";

export const TREE_DEPTH = Number(process.env.NEXT_PUBLIC_TREE_DEPTH ?? "20");

// Encrypted note-delivery + global-leaf indexer (MongoDB-backed). Empty = the
// wallet runs in single-user mode (own notes only, no cross-user send/receive).
// Point NEXT_PUBLIC_DELIVERY_URL at a running backend (e.g.
// http://localhost:8787) to enable cross-user Send/Receive and the off-ramp.
export const DELIVERY_URL = process.env.NEXT_PUBLIC_DELIVERY_URL ?? "";

export function deliveryEnabled(): boolean {
  return Boolean(DELIVERY_URL);
}

// --- Ethereum (Sepolia) side of the bridge ---
export const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC ?? "https://1rpc.io/sepolia";
export const ETH_LOCK = process.env.NEXT_PUBLIC_ETH_LOCK ?? "0x3E48BDF44BD676D3F8cCb796138bBDcDA17e4F25";
// Real ERC-20 USDC escrow (forward lock) + mintable TestUSDC + the relayer service.
export const ETH_USDC = process.env.NEXT_PUBLIC_ETH_USDC ?? "0xC01B461678119117d3359D45a0205C2706AD85Ee";
export const ETH_ESCROW = process.env.NEXT_PUBLIC_ETH_ESCROW ?? "0x60655E8F6D771934f3D57Ff4D5D662fe7A601F2E";
export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:8790";
// Reverse leg: bridging OUT unshields the burned note to this bridge-controlled
// Stellar account (the relayer), conserving value on the Stellar side, before
// the relayer releases the equivalent USDC on Ethereum. Bound in the ZK proof.
export const BRIDGE_SINK = process.env.NEXT_PUBLIC_BRIDGE_SINK ?? "GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR";
export function bridgeLive(): boolean { return Boolean(ETH_USDC && ETH_ESCROW && RELAYER_URL); }
export const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER ?? "GAVKGXALNNSW35QZKLVYL5CNORBEGHBF7KMHEEVW5LEHT5XVNQZDD6KI";

// Decimals for the shielded asset (USDC = 7 on Stellar).
export const ASSET_DECIMALS = 7;
export const ASSET_SYMBOL = "USDC";
// Brand for the shielded representation of USDC (shown for in-pool balances and
// bridged funds): USDC held privately in XORR = "xUSDC".
export const SHIELDED_SYMBOL = "xUSDC";

// --- Swaps (constant-product AMM, deployed via scripts/deploy_amm.sh) ---
export const AMM_ID = process.env.NEXT_PUBLIC_AMM_ID ?? "CD6W7BAZ7DBZB7ZAKLNCSQYQOAFKV36PGZZEGZAUSG3QIFYR3356VL4N";
// Multi-pool factory (create pools + confidential pools): scripts/deploy_pools.sh
export const POOL_FACTORY_ID = process.env.NEXT_PUBLIC_POOL_FACTORY_ID ?? "CADU5RQBNEDPIRLGWOEC62EIGAV6V54KGITMGJ52R2ODT6EUBM66NP55";
export function poolsEnabled(): boolean {
  return Boolean(POOL_FACTORY_ID);
}
// The AMM's two tokens: token_a = USDC SAC (xUSDC's underlying), token_b = native XLM SAC.
export const SWAP_TOKEN_A = process.env.NEXT_PUBLIC_SWAP_TOKEN_A ?? TOKEN_ID;
export const SWAP_TOKEN_B = process.env.NEXT_PUBLIC_SWAP_TOKEN_B ?? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
export const SWAP_TOKEN_A_SYMBOL = process.env.NEXT_PUBLIC_SWAP_TOKEN_A_SYMBOL ?? "USDC";
export const SWAP_TOKEN_B_SYMBOL = process.env.NEXT_PUBLIC_SWAP_TOKEN_B_SYMBOL ?? "XLM";
export function swapEnabled(): boolean {
  return Boolean(AMM_ID);
}

export function isConfigured(): boolean {
  return Boolean(POOL_ID && TOKEN_ID);
}

// A funded account used only as the SOURCE for read-only simulations (pool
// reserves, quotes, chain state) so the UI can load on-chain data before any
// wallet connects. Overridden by the connected wallet once available.
export const SIM_SOURCE =
  process.env.NEXT_PUBLIC_SIM_SOURCE ?? "GBKZC3N4UVFZ54CAM7I26NWIDQLQJVPPUVDNLDBAS5PC3BAUA3GYOYXR";
