import { NextResponse } from "next/server";
import { getSession, routingIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Sender-side: resolve an email/@handle to a deliverable encPub. Works even if
// the recipient has never logged in (deterministic derivation). A session is
// optional (Freighter senders have none) — the backend service token gates
// access and rate-limits per caller.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const recipient = String(body?.recipient || "").trim();
  if (!recipient) return NextResponse.json({ error: "recipient required" }, { status: 400 });

  const session = await getSession();
  let senderUid = "anon";
  if (session) { try { senderUid = routingIdentity(session).routingUid; } catch { /* anon */ } }

  const { status, data } = await callBackend(
    "/identity/resolve",
    { routingUid: senderUid, role: "send" },
    { recipient },
  );
  return NextResponse.json(data, { status });
}
