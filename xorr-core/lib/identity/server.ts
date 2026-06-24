// Server-only glue between the Auth.js session and the custodial backend.
//
// The browser never talks to the backend identity endpoints directly. Instead it
// calls our same-origin /api/identity/* routes; those routes (1) read the
// verified SSO session, (2) compute the canonical *routing identity*, (3) mint a
// short-lived HS256 service token carrying ONLY server-verified claims, and (4)
// forward to the backend. This is the trust boundary: the backend authorizes on
// the token, so a client can never act for an identity it doesn't own.
import "server-only";
import { SignJWT } from "jose";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { normalizeEmail, normalizeHandle, isEmail } from "@/lib/identity/normalize";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_DELIVERY_URL || "http://localhost:8787";

const ISSUER = "xorr-next";
const AUDIENCE = "xorr-backend";

function serviceKey(): Uint8Array {
  const s = process.env.SERVICE_SECRET;
  if (!s || s.length < 16) throw new Error("SERVICE_SECRET missing/short (must match the backend)");
  return new TextEncoder().encode(s);
}

export interface RoutingIdentity {
  routingUid: string;
  emailNorm?: string;
}

export type AppSession = Session & {
  uid?: string;
  provider?: string;
  emailVerified?: boolean;
  handle?: string;
};

/**
 * Canonical identity a user's custodial wallet is rooted in:
 *  - a VERIFIED email → `email:<normEmail>` (so email-addressed payments land),
 *  - else an X/GitHub handle → `handle:<handle>`,
 *  - else the opaque `oauth:<uid>` (can still receive sb1: sends, but not
 *    email/handle sends — documented limitation).
 * Unverified emails are deliberately NOT used as a wallet root (anti-spoofing).
 */
export function routingIdentity(session: AppSession): RoutingIdentity {
  const email = session?.user?.email || undefined;
  if (email && session?.emailVerified && isEmail(email)) {
    const emailNorm = normalizeEmail(email);
    return { routingUid: `email:${emailNorm}`, emailNorm };
  }
  if (session?.handle) return { routingUid: `handle:${normalizeHandle(session.handle)}` };
  if (session?.uid) return { routingUid: `oauth:${session.uid}` };
  throw new Error("no routable identity on session");
}

export async function getSession(): Promise<AppSession | null> {
  const s = await auth();
  return (s ?? null) as AppSession | null;
}

/** Mint a short-lived service token with server-verified claims only. */
export async function mintServiceToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(serviceKey());
}

/** Call a backend identity endpoint with a freshly minted service token. */
export async function callBackend<T = unknown>(
  path: string,
  claims: Record<string, unknown>,
  body: Record<string, unknown> = {},
): Promise<{ status: number; data: T }> {
  const token = await mintServiceToken(claims);
  let r: Response;
  try {
    r = await fetch(`${BACKEND_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { status: 502, data: { error: "identity backend unreachable — is it running?" } as T };
  }
  let data: T;
  try { data = (await r.json()) as T; } catch { data = {} as T; }
  return { status: r.status, data };
}
