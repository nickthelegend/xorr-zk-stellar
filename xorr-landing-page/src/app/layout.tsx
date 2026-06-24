import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: { default: 'XORR — Private-by-default money on Stellar', template: '%s | XORR' },
  description: 'Shield USDC on Stellar into unlinkable UTXO notes, pay privately with amounts and counterparties hidden, and prove every spend in zero knowledge — verified on-chain by a BN254 Groth16 contract on Soroban. Private, not anonymous.',
  keywords: ['XORR', 'Stellar', 'Soroban', 'zero knowledge', 'ZK', 'Groth16', 'BN254', 'private payments', 'shielded UTXO', 'Poseidon', 'private USDC', 'ZK bridge', 'confidential payments'],
  icons: {
    icon: "/xorr-logo.png",
    apple: "/xorr-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-[#ebebeb] overflow-x-hidden">{children}</body>
    </html>
  );
}
