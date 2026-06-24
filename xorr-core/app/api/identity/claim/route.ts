import { NextResponse } from "next/server";
import { getSession, routingIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Recipient-side: ensure their custodial Stellar account exists + is funded and
// (best-effort) has a USDC trustline, so a claimed note is actually spendable.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let routing;
  try { routing = routingIdentity(session); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { status, data } = await callBackend("/identity/claim", { ...routing, role: "recv" });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
