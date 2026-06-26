"use client";
import { useEffect, useState } from "react";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  // React 19 + Next App Router don't re-fire framer-motion's SSR'd `initial`
  // enter animations after hydration — the tree stays frozen at opacity:0.
  // Keying the wrapper on a client-mount flag forces a fresh client mount of
  // the motion tree so the enter animations actually play.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return <div key={mounted ? "client" : "ssr"}>{children}</div>;
}
