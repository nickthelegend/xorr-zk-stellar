# Security Audit — XORR Pay-to-Email / SSO Custodial Payments

**Scope:** the pay-to-email feature added on 2026-06-24 — custodial SSO identity, deterministic
key derivation, the delivery/identity backend, and the Next API surface. Specifically:

- `xorr-core/lib/identity/*` (`derive.ts`, `normalize.ts`, `server.ts`, `provider.ts`, `self-hosted.ts`, `types.ts`, stubs)
- `xorr-core/lib/auth.ts`, `xorr-core/app/api/auth/[...nextauth]/route.ts`, `xorr-core/app/api/identity/*`
- `xorr-core/lib/custodial-signer.ts`, `lib/stellar.ts` (signer hook), `lib/notes.ts` (namespacing), `components/stellar-wallet-provider.tsx`, `components/auth/sign-in-button.tsx`, `app/send/page.tsx`, `app/claim/page.tsx`
- `stellar-privacy/backend/src/{derive,identity,mailer}.mjs`, `server.mjs` wiring

**Not in scope:** the underlying ZK circuits, Soroban contracts, Groth16 verifier, and the
pre-existing delivery endpoints (`/notes`, `/leaves`, `/address`) except where the new feature
changes their risk.

**Methodology:** code review of the diff, data-flow tracing of the send→resolve→deliver→claim→spend
path, threat modeling of the custodial trust boundary, plus executable checks (key-derivation
cross-context equivalence, JWT trust-bridge sign/verify/forgery/alg-pinning, API guard behavior).

---

## 0. Headline — the trust model (read this first)

The feature is, by explicit product decision, **custodial**, with two selectable providers
(`IDENTITY_PROVIDER`):

- **`privy` (default, recommended).** Keys are generated and held in **Privy's TEE**. Each identity
  maps to an app-owned Privy Stellar wallet; the shielded `master` is derived from a *deterministic*
  Privy `raw_sign`, and on-chain txs are signed by Privy. **No root key sits in our infrastructure.**
  The custodial surface is the **Privy App secret** (whoever holds it can ask Privy to sign for any
  app-owned wallet → derive the shielded key → decrypt/move funds).
- **`selfhosted`.** A single backend secret `KMS_MASTER` (`backend/src/derive.mjs`) deterministically
  derives every user's keys. Simpler, zero external dependency, but the root key lives in your env.

Both modes enable the marquee capability — resolving a recipient's encryption key from their email
*before they ever log in*, so you can pay an email with no escrow. Both are custodial; they differ in
*where the root of trust lives* (Privy TEE vs. your env).

The honest privacy statement is therefore:

> Payments are private **from other users and from on-chain observers** (stealth notes are
> unchanged), but they are **not private from the operator**. In `privy` mode the operator's power is
> mediated by the Privy App secret + Privy's policy engine; in `selfhosted` mode it's `KMS_MASTER`.

Calling this "private af" to end users without that caveat would be misleading. Everything below is
graded against the goal of *making the custodial model as safe as it can be* and *charting the path
off it*. **Privy is a meaningful improvement** over the self-hosted KMS: the signing key never exists
in our process memory or env, and Privy adds policy controls, key export, and recovery.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Informational.

---

## 1. Findings

### 🔴 C-1 — Single root of custodial compromise *(by design; reduced by Privy)*
**Where:** `selfhosted` → `KMS_MASTER` in `backend/src/derive.mjs`. `privy` → the **Privy App secret** in `backend/.env`, used by `backend/src/privy.mjs` to `raw_sign` for app-owned wallets.
**Impact:** whoever holds the root credential can derive shielded masters and sign Stellar txs ⇒ decrypt delivered notes and move custodial funds. No per-user isolation; no forward secrecy.
- `selfhosted`: leak of `KMS_MASTER` (env, backup, memory dump, insider) = **total** compromise of all users.
- `privy`: the raw ed25519 keys are in **Privy's TEE** and never enter our process, so a memory dump/env leak of *our* server does **not** by itself expose keys. The risk concentrates on the **Privy App secret** + Privy account takeover. This is strictly better, and Privy adds policy/allowlist controls and audit logging on top.
**Mitigations in place:** App secret / `KMS_MASTER` are env-only, never logged; the Stellar secret is never returned to the client (`provision` omits it); signing is server-side; responses are `no-store`. Privy raw-sign verified to refuse signing for non-owned accounts at the app layer (F-M4).
**Remediation (priority):**
1. **Prefer `privy`** (default) over `selfhosted` so no root key lives in your env. Lock the Privy App secret in a cloud secret manager; enable Privy **wallet policies** (restrict which operations/destinations app-owned wallets may sign) to blunt C-1 and M-4.
2. Add a derivation **epoch** (F-M5) for rotation; consider user-owned (non-custodial) Privy wallets for users who don't need pre-login receive (trades away pay-to-unregistered).
3. For `selfhosted`: wrap `KMS_MASTER` in KMS/HSM + per-user passphrase wrapping.

### 🟠 H-1 — Identity binding trusts provider-supplied `email_verified`
**Where:** `lib/auth.ts` `jwt` callback sets `token.emailVerified`; `lib/identity/server.ts:routingIdentity` roots the wallet in `email:<normEmail>` whenever `emailVerified` is true.
**Issue:** the wallet that holds a victim's money is unlocked by *any* login that presents the victim's email marked verified. We currently treat **GitHub as always-verified** and rely on Google's `profile.email_verified`. GitHub can return a non-primary/unverified email depending on scope; a provider misconfiguration or a provider that lets users set an arbitrary "verified" email becomes full account takeover of that email's funds.
**Impact:** account/funds takeover via email spoofing through a weak provider.
**Remediation:** never assume verification — for GitHub, fetch the primary email via the API and check `verified:true`; drop any provider whose email cannot be cryptographically trusted; for X/Twitter (no email) bind only to `handle:` identity, never to a guessed email. Add a test asserting unverified emails never produce an `email:` routing uid.

### 🟠 H-2 — Dev credentials login is account-takeover if it ever ships enabled
**Where:** `lib/auth.ts` `dev-email` Credentials provider; gated by `NODE_ENV !== "production" || ALLOW_DEV_LOGIN === "true"`. UI in `components/auth/sign-in-button.tsx`.
**Issue:** `dev-email` signs you in as **any email with zero proof**. The guard fails open if someone sets `ALLOW_DEV_LOGIN=true` in production.
**Impact:** trivially log in as anyone → claim/drain their custodial wallet.
**Remediation:** make it impossible to enable in prod — e.g. `if (process.env.NODE_ENV === "production") throw` when dev login is requested, not just "skip". Add a startup assertion and a loud banner. Document that `ALLOW_DEV_LOGIN` must never be set in prod.

### 🟠 H-3 — Shielded `master` is returned to the browser
**Where:** `app/api/identity/me/route.ts` → `/identity/provision` returns `master`; consumed in `components/stellar-wallet-provider.tsx`.
**Issue:** the shielded `master` (which decrypts that user's notes and derives spend keys) must reach the client to scan/decrypt, so it lives in browser memory/`sessionStorage`-scoped state. An XSS on the app steals it ⇒ decrypt + spend that user's notes (scoped to one user, not global).
**Impact:** per-user fund/secret theft via XSS.
**Remediation:** strict CSP and dependency hygiene (the app pulls in snarkjs/wasm/wagmi — large surface); never persist `master` to `localStorage`; consider moving *decryption* server-side too (so only ciphertext+plaintext-amounts transit, never the master) at the cost of more trust in the operator.

### 🟡 M-1 — Deterministic per-email `encPub` enables enumeration + delivery-metadata correlation
**Where:** `identity.mjs:/identity/resolve` returns a deterministic `encPub`/`routeKey` per email and an `exists` flag; delivery routes by the stable `routeKey`.
**Issue:** (a) `exists` is an account-enumeration oracle (is `alice@gmail.com` on XORR?). (b) Because `routeKey = sha256(encPub)` is **derivable from any guessed email**, and the pre-existing `/notes/:to` endpoint is unauthenticated and CORS-open, anyone can poll a target's `routeKey` and learn *how many* payments they've received and *when* (ciphertext is opaque, but the count/timing leak). This is worse than the original design where `encPub` was a random per-wallet value.
**Impact:** deanonymization-by-metadata and presence enumeration.
**Remediation:** remove/aggressively-rate-limit `exists`; move to **tag-based one-time delivery** (already on the project's roadmap in `stellar-privacy/CLAUDE.md`) so routing keys aren't guessable from identity; authenticate `/notes/:to` reads.

### 🟡 M-2 — `resolve`/`notify` allow unauthenticated callers; `notify` is a spam/phishing vector
**Where:** `app/api/identity/resolve/route.ts`, `app/api/identity/notify/route.ts` (session optional → `routingUid:"anon"`); backend `identity.mjs` rate-limits per `routingUid`.
**Issue:** all anonymous callers share one `anon` rate-limit bucket (weak per-attacker limiting + easy DoS of legit anon users). `notify` will email *any* address a generic "you have a private payment, sign in to claim" **without any proof a payment occurred** — a brandable phishing/spam primitive.
**Impact:** email spam/phishing under the XORR brand; rate-limit bypass/DoS.
**Remediation:** require an authenticated sender for `notify`; bind `notify` to a server-verified delivery (e.g. the blob/commitment must exist) so you can't email without paying; rate-limit per IP + per sender; add CAPTCHA/proof-of-work for anon `resolve`.

### 🟡 M-3 — Open CORS + unauthenticated delivery endpoints (pre-existing, now higher-impact)
**Where:** `backend/src/server.mjs` `app.use(cors())` (wildcard) over `/notes`, `/leaves`, `/address`.
**Issue:** the new identity endpoints are hardened (service token + `blockBrowser` origin check), but the **delivery** endpoints remain world-readable/writable. Combined with M-1's guessable `routeKey`, the metadata leak and blob-spam risk increase.
**Remediation:** scope CORS to `APP_URL`; authenticate/rate-limit `/notes` reads and writes; cap blob sizes/counts per `routeKey`.

### 🟡 M-4 — `sign-tx` validates source but not operation semantics
**Where:** `backend/src/identity.mjs:/identity/sign-tx`.
**Good:** refuses to sign any tx whose `source` isn't the caller's own derived account (verified by re-deriving from the session's routing identity) — prevents signing for arbitrary accounts.
**Gap:** it will sign *any* operation on the user's own account. An XSS'd or malicious client could get the user to sign a `withdraw`/`transfer` to an attacker-controlled destination.
**Remediation:** parse the XDR and allowlist only expected operations (invoke of the configured pool contract/methods); optionally surface a human-readable confirmation. Defense-in-depth against H-3.

### 🟡 M-5 — No key rotation / revocation
**Where:** derivation is pure `f(KMS_MASTER, uid)` with no version.
**Issue:** if a user's email is compromised, or `KMS_MASTER` must be rotated, there is no per-user re-key — rotating `KMS_MASTER` breaks *everyone* and orphans all undelivered notes.
**Remediation:** add a derivation **epoch/version** into the HKDF `info`/salt (`xorr-...-v1` → per-user epoch), stored alongside the salted email hash, so a single identity can be rotated.

### 🔵 L-1 — Email normalization: folding ambiguity & no IDN/homograph handling
**Where:** `lib/identity/normalize.ts` (mirrored in `derive.mjs`).
**Issue:** Gmail dot/`+tag` folding is correct for Gmail but means visually different addresses map to one wallet; non-Gmail keeps dots; IDN/punycode and confusable characters aren't normalized, enabling "pay the wrong person" tricks. The Send UI does show the normalized form (good — `app/send/page.tsx` resolve preview).
**Remediation:** punycode-normalize domains, add confusable detection, and keep showing the normalized recipient prominently before send (already partially done).

### 🔵 L-2 — In-memory, per-process rate limiting
**Where:** `backend/src/identity.mjs` `hits` map (and faucet's pattern).
**Issue:** resets on restart, not shared across instances → bypassable at scale.
**Remediation:** Redis/durable store; align with M-2.

### 🔵 L-3 — Service token: 2-min TTL, no `jti`/replay binding
**Where:** `lib/identity/server.ts:mintServiceToken`, `identity.mjs:requireService`.
**Good:** HS256 with shared secret, issuer/audience pinned, **alg pinned** (verified: forged-secret and `alg:none` are rejected).
**Gap:** a token leaked (e.g. via logs) is replayable for its lifetime for that uid's own actions; no per-request nonce; secret shared symmetrically between two services.
**Remediation:** shorten TTL, add `jti` + single-use cache, prefer asymmetric (Next signs, backend verifies with public key) and/or mTLS on the internal hop.

### 🔵 L-4 — Testnet `claim` spends a shared faucet resource
**Where:** `identity.mjs:/identity/claim` uses friendbot; idempotency via `claimedAt` upsert.
**Issue:** a user can mint many identities and repeatedly invoke friendbot. Testnet-only, but the same code path on mainnet needs real sponsorship + hard idempotency.
**Remediation:** operator-sponsored reserves with a strict per-identity idempotency guard before mainnet.

### 🟡 M-6 — Privy: App-secret custody, wallet policies, and key-rotation coupling
**Where:** `backend/src/privy.mjs`, `backend/.env` (`PRIVY_APP_SECRET`).
**Issues:**
1. The App secret is the custodial root (see C-1). It must live in a secret manager, and Privy's **wallet policy engine** should be enabled to restrict what app-owned wallets can sign (defense-in-depth for M-4 / C-1) — by default an app-owned wallet will `raw_sign` any 32-byte hash.
2. **Derivation is coupled to Privy's signing determinism.** The shielded `master` = `HKDF(rawSign(wallet, FIXED_HASH))`. This relies on Privy ed25519 `raw_sign` being deterministic (verified true today). If Privy ever changed signing nonces or rotated a wallet's underlying key, **every derived master would change → all previously-routed notes become undecryptable.** Treat the derivation scheme + Privy's guarantee as a pinned dependency; add a stored derivation **epoch** (F-M5) and, ideally, persist the derived `encPub` rather than always re-deriving so a Privy-side change is detectable, not silently fund-losing.
3. **Credential exposure:** the App secret used here was transmitted in plaintext chat and is stored in `backend/.env`. **Rotate it in the Privy dashboard** and treat the shared value as burned.
**Remediation:** secret manager + Privy policies + epoch + persist `encPub`; rotate the exposed secret.

### 🟡 M-7 — `private_swap` (ZK swaps): privacy model + AMM-venue trust
**Where:** `privacy-pool` `private_swap` (reuses the **Withdraw** verifying key) + `set_swap_venue`, routing through the `pool-factory` AMM.
**What it provides:** a Groth16 proof spends a shielded note (note ∈ tree, nullifier valid, value conserved, recipient bound), then the pool routes the amount through the AMM to the recipient — **no public account links the spender to the trade**; identity/linkage/balance stay hidden.
**Honest limits (state them, not bugs):**
1. **Amount is public.** A constant-product AMM must see `amount_in`/`amount_out` to price + move reserves, so trade *size* is visible. Only identity, the funding note, and remaining balance are hidden — don't imply amount privacy.
2. **VK reuse is sound:** the statement `private_swap` needs (a legitimate private note-spend of `amount`) is exactly Withdraw's. The two paths are intentionally coupled — a Withdraw-circuit change affects both.
3. **Venue trust:** `set_swap_venue` is admin-set; a wrong/hostile AMM could return little output — mitigated by the caller's `min_out` floor, but the venue address is trusted. Recommend a timelock on `set_swap_venue` and on-chain verification of the AMM pair.
4. **`authorize_as_current_contract`** pre-authorizes exactly one `token_in.transfer(pool→factory, amount)` (correct, minimal scope). Re-check if the AMM transfer shape changes.

### ⚪ Informational
- **Privacy disclosure:** surface the "private from peers, not from operator" statement in-product (Receive/Claim copy), not just in docs.
- **Two Privy models:** server-side app-owned wallets (used here — enables pay-to-email) vs. client-side user-owned embedded wallets (`components/auth/privy-create-wallet.tsx`, the `useCreateWallet` path). The latter is more non-custodial but cannot do pre-login resolve; keep them distinct in docs so the trust model isn't accidentally mixed.
- **Magic-link not wired:** only OAuth + dev login are implemented; Auth.js email magic-link needs a DB adapter (`@auth/mongodb-adapter`) for verification tokens — documented in `.env.example`, not built.
- **UX limitation:** `pool.payTo` requires ≥2 notes (`lib/pool.ts`), so a fresh recipient holding one received note can `withdraw` but not `payTo` until they split/deposit.
- **Test coverage:** unit tests cover derivation + normalization (the correctness-critical core). Backend endpoint integration tests (resolve/provision/claim/sign-tx authz) are recommended.

---

## 2. What was verified (executable evidence)

| Check | Result |
|---|---|
| Frontend `derive.ts` and backend `derive.mjs` derive **byte-identical** `encPub` + Stellar address for the same `(KMS, uid)` — the make-or-break correctness invariant | ✅ matched |
| Unit suite (`npm test`, 34 tests incl. 8 new derivation/normalization) | ✅ 34/34 pass |
| `tsc --noEmit` | ✅ clean |
| App boots; Send page shows pay-by-email + Resolve; header shows Sign in; Claim nav present | ✅ rendered |
| Auth.js wired (`/api/auth/session` → 200); identity guards (`/api/identity/me` → 401 unauth); backend-offline degrades gracefully (`/identity/resolve` → 502, not 500) | ✅ |
| JWT service-token bridge: valid verify ✓, forged-secret rejected ✓, `alg:none` rejected ✓ | ✅ |
| **Privy (live API, real credentials)**: create Stellar wallet, `raw_sign` (ed25519), **determinism** across calls | ✅ |
| **Privy on-chain**: fund via friendbot → Privy-sign → submit testnet tx | ✅ [`ab0e822e…`](https://stellar.expert/explorer/testnet/tx/ab0e822e81d57c6ac2858cce103cb82352646ab7b6121bb57e1707472da95748), [`dc41b853…`](https://stellar.expert/explorer/testnet/tx/dc41b8537c77ca72859b44c7b8b80947a12f9d540223f0fba74cb06b9986af43) |
| Backend `npm test`: `privy.test.mjs` (7) + `identity.endpoints.test.mjs` (6) | ✅ 13/13 |
| **Pay-to-email invariant (live, via HTTP endpoints)**: sender-`resolve(B.OB+promo@gmail.com)` encPub == recipient-`provision(bob@gmail.com)` encPub | ✅ |
| `sign-tx` refuses a tx whose source ≠ caller's account | ✅ |

**Not exercised here (requires external resources):** full server with a live **MongoDB** (the
endpoint tests use in-memory collections), real Google/X/GitHub **OAuth** (needs registered apps),
real SMTP/Resend delivery, on-chain **ZK proving/claim** (needs circuit artifacts), and the
**client-side** Privy `useCreateWallet` path (needs a browser login). The Privy *server* path —
which is what enables pay-to-email — is verified live end-to-end above.

---

## 3. Remediation roadmap (recommended order)

1. **Before any real funds:** fix H-2 (hard-disable dev login in prod) and H-1 (don't trust unverified emails) — these are cheap and prevent direct takeover.
2. **Harden the surface:** M-2 (authenticate/bind `notify`, drop `exists`), M-3 (scope CORS, auth delivery reads), M-4 (operation allowlist in `sign-tx`), L-3 (token hygiene).
3. **Reduce metadata leakage:** M-1 → tag-based one-time delivery (already on the roadmap).
4. **Address the custodial root (C-1):** migrate to MPC/HSM custody, or add passphrase-wrapping + KMS + rotation epochs (M-5). This is the only change that makes the system *actually* private from the operator.

_Audit date: 2026-06-24 · Testnet · custodial self-hosted provider. This audit covers the new feature only; the broader protocol remains "testnet, not audited" per the project README._
