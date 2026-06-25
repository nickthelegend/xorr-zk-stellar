"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import * as pool from "@/lib/pool";
import { myShieldedAddress, registerAddress } from "@/lib/delivery";
import { useWallet } from "@/components/stellar-wallet-provider";
import { WalletScaffold, Banner } from "@/components/wallet/scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deliveryEnabled } from "@/lib/config";
import { toast } from "sonner";

const labelCls = "font-mono text-[11px] uppercase tracking-wider text-muted-foreground";

export default function ReceivePage() {
  const { wallet, busy, run, pushLog } = useWallet();
  const address = useMemo(
    () => (wallet ? myShieldedAddress(BigInt(wallet.master)) : ""),
    [wallet],
  );
  const [handle, setHandle] = useState("");
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    if (!address) return setQr("");
    QRCode.toDataURL(address, {
      margin: 1,
      width: 220,
      color: { dark: "#ccff00ff", light: "#0a0a0aff" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [address]);

  const copy = () => {
    navigator.clipboard?.writeText(address);
    toast.success("Address copied");
    pushLog("Address copied");
  };

  const register = async () => {
    if (!handle) return;
    try {
      await registerAddress(address, address.split(":")[2], handle);
      pushLog(`Registered @${handle}`);
      toast.success(`Registered @${handle}`);
    } catch (e: unknown) {
      pushLog(`⚠ ${(e as Error).message}`);
    }
  };

  const onScan = () =>
    run("Scanning for incoming notes", async () => {
      const n = await pool.scanIncoming(wallet!, pushLog);
      toast.success(`Scan complete · ${n} new note(s)`);
    });

  return (
    <WalletScaffold
      eyebrow="Receive"
      title="Your shielded address"
      description="Share this to receive private payments. It encodes your receive key + an X25519 encryption key."
    >
      <div className="glass-card rounded-3xl p-6 max-w-lg">
        {/* QR hero */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative rounded-2xl border border-primary/25 bg-[#101010] p-3 shadow-[0_0_40px_rgba(168,85,247,0.18)]">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Shielded address QR code" width={196} height={196} className="rounded-lg" />
              ) : (
                <div className="size-[196px] grid place-items-center text-xs text-muted-foreground">generating…</div>
              )}
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground max-w-sm leading-relaxed">
            Every received note is <span className="text-primary">unlinkable</span> on-chain. Sign in to also get paid by
            email or social handle and <a href="/claim" className="text-primary underline underline-offset-2">claim</a> from any device.
          </p>
        </div>

        {/* Address pill with inline copy */}
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 p-2 pl-3">
          <code className="font-mono text-xs break-all text-foreground/80 flex-1 min-w-0">{address || "—"}</code>
          <Button variant="outline" onClick={copy} disabled={!address} className="h-8 text-xs shrink-0">Copy</Button>
        </div>

        <div className="mt-6 space-y-2">
          <Label className={labelCls}>Claim a handle (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="alice"
              className="bg-white/[0.03] border-white/10 h-11"
            />
            <Button variant="outline" onClick={register} disabled={!handle || !deliveryEnabled()} className="h-11 text-xs shrink-0">
              Register @handle
            </Button>
          </div>
        </div>

        <div className="border-t border-white/5 my-6" />

        {!deliveryEnabled() && (
          <Banner tone="warn">
            Delivery layer off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
          </Banner>
        )}
        <Button onClick={onScan} disabled={busy || !deliveryEnabled()} className="mt-1 w-full h-12 font-mono uppercase tracking-widest text-xs">
          {busy ? "Scanning…" : "Scan for incoming payments"}
        </Button>
      </div>
    </WalletScaffold>
  );
}
