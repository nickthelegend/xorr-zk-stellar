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
      <div className="glass-card rounded-2xl p-6 max-w-lg">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Senders encrypt each note opening to this address, so your reusable address never appears
          on-chain — every received note is unlinkable. Once you sign in (Google · X · GitHub ·
          email), others can also pay you by your email or social handle, and you{" "}
          <a href="/claim" className="text-primary underline underline-offset-2">claim</a> from any device.
        </p>

        {qr && (
          <div className="mt-5 flex justify-center">
            <div className="rounded-2xl border border-primary/20 bg-[#0a0a0a] p-3 shadow-[0_0_30px_rgba(166,242,74,0.08)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Shielded address QR code" width={200} height={200} className="rounded-lg" />
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl bg-background/50 border border-white/10 p-3">
          <code className="font-mono text-xs break-all text-primary/90">{address || "—"}</code>
        </div>
        <Button variant="outline" onClick={copy} className="mt-3 h-9 text-xs" disabled={!address}>
          Copy address
        </Button>

        <div className="mt-6 space-y-2">
          <Label className={labelCls}>Claim a handle (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="alice"
              className="bg-background/50 border-white/10 h-10"
            />
            <Button variant="outline" onClick={register} disabled={!handle || !deliveryEnabled()} className="h-10 text-xs shrink-0">
              Register @handle
            </Button>
          </div>
        </div>

        <div className="border-t border-white/5 my-6" />

        <p className="text-sm text-muted-foreground leading-relaxed">
          Pull incoming payments others sent you (decrypts &amp; adds spendable notes).
        </p>
        {!deliveryEnabled() && (
          <Banner tone="warn">
            Delivery layer off — set <code>NEXT_PUBLIC_DELIVERY_URL</code> + run the backend.
          </Banner>
        )}
        <Button onClick={onScan} disabled={busy || !deliveryEnabled()} className="mt-3 w-full h-11 font-mono uppercase tracking-widest text-xs">
          {busy ? "Scanning…" : "Scan for incoming notes"}
        </Button>
      </div>
    </WalletScaffold>
  );
}
