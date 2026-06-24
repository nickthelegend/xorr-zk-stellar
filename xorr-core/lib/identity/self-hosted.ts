// Default custodial provider — a thin browser client over our same-origin
// /api/identity/* routes (which hold the SSO session and forward to the backend
// vault). No secrets or backend URLs are exposed to the browser here.
import type {
  IdentityWalletProvider, ResolvedRecipient, MyIdentity, ClaimResult,
} from "./types";

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string })?.error || `request failed (${r.status})`);
  return data as T;
}

export class SelfHostedCustodialProvider implements IdentityWalletProvider {
  readonly id = "selfhosted";

  resolveRecipient(emailOrHandle: string): Promise<ResolvedRecipient> {
    return post<ResolvedRecipient>("/api/identity/resolve", { recipient: emailOrHandle });
  }

  async getMyIdentity(): Promise<MyIdentity> {
    const r = await fetch("/api/identity/me", { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data as { error?: string })?.error || "not signed in");
    return data as MyIdentity;
  }

  ensureStellarAccount(): Promise<ClaimResult> {
    return post<ClaimResult>("/api/identity/claim");
  }

  async signTx(xdr: string): Promise<string> {
    const { signedXdr } = await post<{ signedXdr: string }>("/api/identity/sign-tx", { xdr });
    return signedXdr;
  }

  async notify(email: string): Promise<void> {
    await post("/api/identity/notify", { email });
  }
}
