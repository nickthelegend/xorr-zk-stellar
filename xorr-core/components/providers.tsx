"use client";

import { PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { EvmProviders } from "@/lib/evm";
import { StellarWalletProvider } from "@/components/stellar-wallet-provider";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {/* EVM stack (wagmi + RainbowKit + react-query) for the Ethereum→Stellar bridge. */}
      <EvmProviders>
        <StellarWalletProvider>
          {children}
          <Toaster position="top-right" theme="dark" richColors closeButton />
        </StellarWalletProvider>
      </EvmProviders>
    </ThemeProvider>
  );
}
