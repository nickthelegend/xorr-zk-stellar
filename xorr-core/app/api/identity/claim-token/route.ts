import { NextResponse } from "next/server";
import { verifyClaimToken, callBackend } from "@/lib/identity/server";

export const dynamic = "force-dynamic";

// Magic claim-link redemption — the token IS the auth (no Privy sign-in). The
// backend minted it into the claim email; we verify it here at the edge (we
// share SERVICE_SECRET), turn it into the same routing identity the SSO path
// yields, then act for that identity:
//   - body { token }         → provision + fund the account → return { master, … }
//   - body { token, xdr }    → token-authenticated custodial signing (so the
//                              claimed funds can actually be withdrawn/spent)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body?.token || "");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  let routing;
  try {
    routing = await verifyClaimToken(token);
  } catch {
    return NextResponse.json(
      { error: "this claim link is invalid or has expired — ask the sender to resend" },
      { status: 401 },
    );
  }

  const claims = { routingUid: routing.routingUid, emailNorm: routing.emailNorm, role: "recv" };
  const xdr = typeof body?.xdr === "string" ? body.xdr : "";

  // Signing path — the token authorizes signing a tx for its own account only.
  if (xdr) {
    const { status, data } = await callBackend("/identity/sign-tx", claims, { xdr });
    return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  }

  // Claim path — provision the identity (yields master/encPub so the browser can
  // decrypt the delivered note), then fund the Stellar account + USDC trustline.
  const prov = await callBackend<Record<string, unknown>>("/identity/provision", claims);
  if (prov.status >= 400) return NextResponse.json(prov.data, { status: prov.status });
  const funded = await callBackend<Record<string, unknown>>("/identity/claim", claims);

  return NextResponse.json(
    { ...prov.data, ...(funded.status < 400 ? funded.data : { funded: false, trustline: false }) },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
