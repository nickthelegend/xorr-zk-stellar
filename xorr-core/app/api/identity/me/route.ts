import { NextResponse } from "next/server";
import { getSession, routingIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Returns the authenticated user's custodial identity (master + encPub +
// stellarPub). `master` is secret-ish (needed client-side to decrypt notes);
// the Stellar secret never leaves the backend (signing is server-side).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let routing;
  try { routing = routingIdentity(session); } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const { status, data } = await callBackend("/identity/provision", { ...routing, role: "recv" });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
