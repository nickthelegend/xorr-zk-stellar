import { NextResponse } from "next/server";
import { getSession, routingIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Sender-side: email the recipient "you have a private payment waiting". The
// backend sends a generic, amount-free message and never persists the address.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const session = await getSession();
  let senderUid = "anon";
  if (session) { try { senderUid = routingIdentity(session).routingUid; } catch { /* anon */ } }

  const { status, data } = await callBackend(
    "/identity/notify",
    { routingUid: senderUid, role: "send" },
    { email },
  );
  return NextResponse.json(data, { status });
}
