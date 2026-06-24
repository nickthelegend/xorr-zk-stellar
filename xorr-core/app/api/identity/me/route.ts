import { NextResponse } from "next/server";
import { privyIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Returns the signed-in user's custodial identity (master + encPub + stellarPub).
// Authenticated by the caller's Privy access token. `master` reaches the client
// (needed to decrypt notes); the Stellar secret never leaves the backend.
export async function GET(req: Request) {
  const routing = await privyIdentity(req);
  if (!routing) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { status, data } = await callBackend("/identity/provision", { ...routing, role: "recv" });
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
