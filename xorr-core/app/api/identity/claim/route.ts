import { NextResponse } from "next/server";
import { privyIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Recipient-side: ensure their custodial Stellar account exists + is funded and
// (best-effort) has a USDC trustline, so a claimed note is actually spendable.
export async function POST(req: Request) {
  const routing = await privyIdentity(req);
  if (!routing) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { status, data } = await callBackend("/identity/claim", { ...routing, role: "recv" });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
