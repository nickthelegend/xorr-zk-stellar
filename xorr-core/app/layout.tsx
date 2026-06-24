import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppHeader } from "@/components/header"
import { AppFooter } from "@/components/footer"
import { Providers } from "@/components/providers"
import { Suspense } from "react"
import { ErrorBoundary } from "@/components/error-boundary"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

const SITE = "https://app.xorr.finance"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a6f24a",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "XORR — Private-by-default money on Stellar",
    template: "%s | XORR",
  },
  description:
    "XORR is a shielded wallet on Stellar: shield USDC into unlinkable UTXO notes, pay privately with amounts and counterparties hidden, bridge ETH into shielded notes, and prove every spend in zero knowledge — verified on-chain by a BN254 Groth16 contract on Soroban.",
  applicationName: "XORR",
  keywords: [
    "XORR", "Stellar", "Soroban", "zero knowledge", "ZK", "Groth16", "BN254",
    "private payments", "shielded UTXO", "Poseidon", "private USDC", "ZK bridge",
    "confidential payments", "selective disclosure",
  ],
  authors: [{ name: "XORR", url: SITE }],
  category: "finance",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "XORR",
    url: SITE,
    title: "XORR — Private-by-default money on Stellar",
    description:
      "Shield USDC, pay privately, bridge ETH, prove every spend in zero knowledge on Stellar.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "XORR — Private-by-default money on Stellar",
    description: "A shielded ZK wallet on Stellar: private payments, ETH bridge, on-chain Groth16.",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/xorr-logo.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  manifest: "/manifest.webmanifest",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body className={`font-mono ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${GeistSans.variable} ${GeistMono.variable} antialiased min-h-dvh bg-background`}>
        <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
          <Providers>
            <ErrorBoundary>
              <div className="mx-auto w-full flex flex-col min-h-screen px-4 md:px-8 lg:px-12">
                <AppHeader />
                <main className="pb-24 flex-grow">{children}</main>
                <AppFooter />
              </div>
            </ErrorBoundary>
          </Providers>
        </Suspense>
      </body>
    </html>
  )
}
