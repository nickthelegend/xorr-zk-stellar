import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XORR — Private money on Stellar",
    short_name: "XORR",
    description: "A shielded ZK wallet on Stellar: private USDC payments, an ETH bridge, and on-chain Groth16 verification.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#a6f24a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
