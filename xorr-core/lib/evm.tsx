"use client";
// EVM wallet stack (RainbowKit + wagmi) for the Ethereum/Sepolia side of the
// bridge. Freighter is the primary (Stellar) wallet; the EVM wallet is only for
// locking on Sepolia + signing token transfers.
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SEPOLIA_RPC } from "./config";

// Injected connector only (MetaMask/Rabby via window.ethereum). We deliberately
// avoid the MetaMask SDK connector — it posts telemetry batches that fail in a
// sandboxed iframe and spam the console without affecting functionality.
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http(SEPOLIA_RPC) },
  ssr: false,
});

const queryClient = new QueryClient();

export function EvmProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#7aa2ff", borderRadius: "medium" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// ABI for the native lock used in the earlier demo (ShieldedBridgeLockNative).
export const LOCK_ABI = [
  {
    type: "function", name: "lock", stateMutability: "payable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
] as const;

// Real ERC-20 USDC escrow (ShieldedBridgeEscrow): lock the actual amount.
export const ESCROW_ABI = [
  {
    type: "function", name: "lock", stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }, { name: "commitment", type: "bytes32" }],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
  {
    type: "event", name: "Locked",
    inputs: [
      { name: "nonce", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "commitment", type: "bytes32", indexed: false },
      { name: "from", type: "address", indexed: true },
    ],
  },
] as const;

// Mintable TestUSDC (open faucet + standard ERC-20 approve/balanceOf).
export const USDC_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;
