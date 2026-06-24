/// <reference types="vite/client" />

// Third-party libs that ship without TypeScript types.
declare module "snarkjs";
declare module "circomlibjs";

interface ImportMetaEnv {
  readonly VITE_STELLAR_NETWORK?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_POOL_ID?: string;
  readonly VITE_BRIDGE_ID?: string;
  readonly VITE_VERIFIER_ID?: string;
  readonly VITE_TOKEN_ID?: string;
  readonly VITE_TREE_DEPTH?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
