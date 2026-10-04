// Client helpers for the magic claim link (…/claim?t=<token>). The token — not a
// Privy session — is the credential: opening the emailed link redeems the
// pending payment, and the same token signs the follow-up spend/withdraw txs.
// All auth happens server-side in /api/identity/claim-token.

export interface ClaimTokenResult {
  master: string; // shielded root — decrypts the delivered note in-browser
  encPub: string; // base64 X25519
  routeKey: string; // where the encrypted note blob was delivered
  stellarPub: string; // G… custodial account
  funded: boolean;
  trustline: boolean;
}

async function post<T>(body: unknown): Promise<T> {
  const r = await fetch("/api/identity/claim-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string })?.error || `request failed (${r.status})`);
  return data as T;
}

/** Redeem a claim token: provision + fund the account, return the identity bundle. */
export function redeemClaimToken(token: string): Promise<ClaimTokenResult> {
  return post<ClaimTokenResult>({ token });
}

/** A custodial signer bound to a claim token (used after claim, for withdraw/send). */
export function claimTokenSigner(token: string): (xdr: string) => Promise<string> {
  return async (xdr: string) => {
    const { signedXdr } = await post<{ signedXdr: string }>({ token, xdr });
    return signedXdr;
  };
}
