import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["100", "400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "XORR — Private-by-default money on Stellar",
    template: "%s | XORR",
  },
  description:
    "A zero-knowledge USDC wallet on Stellar. Shield your balance, pay privately, bridge from Ethereum, and earn or borrow — every spend proven in zero knowledge and verified on-chain.",
  keywords: [
    "XORR",
    "Stellar",
    "Soroban",
    "zero knowledge",
    "ZK",
    "private payments",
    "shielded USDC",
    "xUSDC",
    "Groth16",
    "BN254",
    "Poseidon",
    "privacy pool",
    "cross-chain bridge",
    "DeFi lending",
    "confidential transactions",
  ],
  openGraph: {
    title: "XORR — Private-by-default money on Stellar",
    description:
      "Shielded notes, ZK proofs verified on Soroban, a real ETH↔Stellar bridge, and an on-chain money market. Private by default.",
    siteName: "XORR",
    type: "website",
  },
  category: "finance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${poppins.variable} ${poppins.className} bg-[#101010] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
