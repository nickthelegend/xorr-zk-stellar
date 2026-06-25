import type React from "react"
import type { Metadata, Viewport } from "next"
import { Poppins, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppHeader } from "@/components/header"
import { AppFooter } from "@/components/footer"
import { Providers } from "@/components/providers"
import { Suspense } from "react"
import { ErrorBoundary } from "@/components/error-boundary"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-poppins",
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
  themeColor: "#a855f7",
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
      <body className={`font-sans ${poppins.variable} ${poppins.className} ${jetbrainsMono.variable} antialiased min-h-dvh bg-background`}>
        <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
          <Providers>
            <ErrorBoundary>
              <div className="flex flex-col min-h-screen">
                {/* Ghost-style fixed top nav */}
                <AppHeader />
                {/* Content column — pt-16 clears the fixed h-16 nav */}
                <div className="mx-auto w-full flex flex-grow flex-col px-4 md:px-8 lg:px-12 pt-16">
                  <main className="pb-24 flex-grow">{children}</main>
                  <AppFooter />
                </div>
              </div>
            </ErrorBoundary>
          </Providers>
        </Suspense>
      </body>
    </html>
  )
}
