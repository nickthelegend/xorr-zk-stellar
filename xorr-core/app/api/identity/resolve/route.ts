import { NextResponse } from "next/server";
import { privyIdentity, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Sender-side: resolve an email/@handle to a deliverable encPub (works even if
// the recipient has never logged in). Sender auth (Privy) is optional and used
// only for rate-limit keying; the backend service token gates real access.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const recipient = String(body?.recipient || "").trim();
  if (!recipient) return NextResponse.json({ error: "recipient required" }, { status: 400 });

  const routing = await privyIdentity(req);
  const senderUid = routing?.routingUid || "anon";

  const { status, data } = await callBackend(
    "/identity/resolve",
    { routingUid: senderUid, role: "send" },
    { recipient },
  );
  return NextResponse.json(data, { status });
}
