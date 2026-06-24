import { NextResponse } from "next/server";
import { getSession, routingIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Server-side custodial signing: the recipient's Stellar secret never reaches
// the browser. The backend re-derives the key from the SESSION's routing
// identity and refuses to sign any tx whose source isn't that account.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const xdr = String(body?.xdr || "");
  if (!xdr) return NextResponse.json({ error: "xdr required" }, { status: 400 });
  let routing;
  try { routing = routingIdentity(session); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { status, data } = await callBackend("/identity/sign-tx", { ...routing, role: "recv" }, { xdr });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
