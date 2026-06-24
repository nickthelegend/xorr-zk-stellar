import { NextResponse } from "next/server";
import { privyIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Server-side custodial signing: the recipient's Stellar secret never reaches
// the browser. The backend re-derives the key from the verified identity and
// refuses to sign any tx whose source isn't that account.
export async function POST(req: Request) {
  const routing = await privyIdentity(req);
  if (!routing) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const xdr = String(body?.xdr || "");
  if (!xdr) return NextResponse.json({ error: "xdr required" }, { status: 400 });
  const { status, data } = await callBackend("/identity/sign-tx", { ...routing, role: "recv" }, { xdr });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
