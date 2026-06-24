"use client";

import { PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SessionProvider } from "next-auth/react";
import { EvmProviders } from "@/lib/evm";
import { StellarWalletProvider } from "@/components/stellar-wallet-provider";
import { PrivyProvider } from "@/components/auth/privy-provider";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {/* SSO session (Auth.js) wraps everything so the wallet provider can pick
          up a custodial identity on sign-in. Privy (gated on its app id) adds the
          optional client-side embedded-wallet path. */}
      <SessionProvider>
       <PrivyProvider>
        {/* EVM stack (wagmi + RainbowKit + react-query) for the Ethereum→Stellar
            bridge. Freighter + SSO custodial are the Stellar wallets below. */}
        <EvmProviders>
          <StellarWalletProvider>
            {children}
            <Toaster position="top-right" theme="dark" richColors closeButton />
          </StellarWalletProvider>
        </EvmProviders>
       </PrivyProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
