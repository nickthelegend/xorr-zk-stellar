---
format: 1920x1080
message: "Private money, made real — spend USDC on Stellar with everything hidden, proven in zero knowledge."
arc: Hook → Problem → Shield (mechanism) → Pay → Bridge → Off-ramp → Proof + CTA
audience: crypto-native users and stablecoin holders who want real privacy
music: "confident minimal electronic — premium, restrained, low-hype, cinematic tech; steady pulse, no drop"
audio_direction: "BGM ~5% under voice. One SFX per beat at ~20%, premium and NON-click (sub hits, whooshes, shimmers, brand swell) — NO clock/ticking. Click SFX ONLY on the between-frame transition seams. Narrator: calm, assured, low-hype."
captions: "karaoke word-by-word; active word = DARK text (#0d0d0f) on the accent block (#a855f7 / #e2a9f1) — readable, never white-on-accent."
---

## Video direction

- **palette system** (from `frame.md`, never invented): canvas `#0d0d0f`; text `#ffffff`; muted `#a1a1aa`. Accent `#a855f7` (purple) carries every eyebrow, keyword-glow, payoff word ("public", "hidden", "verified") and the closing URL; `#e2a9f1` (soft lavender) is the secondary highlight; `#a6f24a` (lime) is the single positive/success note (off-ramp "completed", checkmarks). Cards are a subtle white tint (4% white fill / 12% white border), **no heavy shadow** — matching the XORR app.
- **motion grammar + reveal model**: smooth long-tail **`power3`** everywhere — **no bounce / overshoot / elastic**. **VO-paced reveal**: at t=0 only what the voice is saying enters; every further piece (line, card, glyph, stat) reveals on its spoken cue, sequenced across the **back ~50%** — never front-load. One slow single push (`multi-phase-camera`) may sit under a UI reveal; **no back-half re-push, no lazy breathing**. Every frame ends on a **held read** — stillness, with **subtle jitter** (`sine-wave-loop`, low amplitude) as the only aliveness. Internal seams are velocity-matched (`zoom-through` / `cut-the-curve` → `cut-catalog.md`).
- **rhythm / held-frame allocation**: F1–F2 punchy kinetic (energy up) → **F3 the calm mechanism, a breather** (longer holds) → F4–F6 steady, even feature reveals → **F7 climaxes then holds long on the brand + URL**. Deliberate held beats: end of F3 (the commitment), end of F5 (no-link), and the whole close of F7.
- **negative list**: no nav bars / footers / scrollbars / real browser chrome (the app screenshots are the only "UI", shown as intentional tilted surfaces); no floating bokeh or purple-blue "AI" gradients; **no clock / ticking / stopwatch imagery**. Forbidden motion: slideshow (front-load-then-freeze), screensaver (independent floaters), any `back/bounce/elastic`, any `repeat`/`yoyo`, any `Math.random`/`Date.now`.

## Frame 1 — Hook: it's all public

- scene: One line punches onto black; the word "public" lands hard in accent.
- voiceover: "On a blockchain, every payment is public."
- duration: 5s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Pain validation
- beat: tension
- blueprint: kinetic-type-beats
- sfx: deep sub impact
- asset_candidates:

narrativeRole: Open cold on the uncomfortable truth that creates the tension the whole video resolves.
keyMessage: On-chain money has no privacy by default.

blueprint: kinetic-type-beats (Reproduce) · focal: none (typography)
Scene 1 (0.0–1.4s): black field `#0d0d0f`; "On a blockchain," enters center-upper via per-word staggered reveal (`dynamic-content-sequencing`) on a smooth long-tail (`power3`). Centered, ~55% width, upper-third.
Scene 2 (1.4–2.4s): "every payment" slams in on its beat beneath the first line (`kinetic-beat-slam`), velocity-matched.
Scene 3 (2.4–end): "is public." slams in and **"public" locks in accent `#a855f7`** with an ambient glow bloom (`ambient-glow-bloom`) behind it and a keyword glow (`asr-keyword-glow`) as the VO lands the word. Centered climax ~50%; then holds dead-still — subtle jitter (`sine-wave-loop`, low) only.

## Frame 2 — The problem: traceable forever

- scene: Short exposure statements land solo on a bare canvas — balance, who you pay, how much — then "traceable — forever."
- voiceover: "Your balance. Who you pay. How much. Traceable — forever."
- duration: 6.5s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-problem.html
- type: pain_point
- persuasion: Pain agitation
- beat: anxiety + exposure
- blueprint: kinetic-type-beats
- sfx: muted glass hit
- asset_candidates:

narrativeRole: Agitate — make the abstract "public" concrete and personal so the fix feels needed.
keyMessage: Everything about your money is exposed and permanent.

blueprint: kinetic-type-beats (Adapt — statements land solo in one slot, then stack for the finale; keep the beat-slam signature) · focal: none (typography)
Scene 1 (0.0–1.0s): "Your balance." slams into a single center slot (`kinetic-beat-slam`, `power3`). Centered ~45%.
Scene 2 (1.0–1.9s): hard-cut flash word-swap (`discrete-text-sequence`) → "Who you pay." replaces it in place, velocity-matched (`cut-catalog.md` waterfall).
Scene 3 (1.9–2.8s): flash-swap → "How much." in the same slot.
Scene 4 (2.8–end): the three phrases settle into a left-aligned stack (asymmetric 60/40) and **"Traceable — forever." lands below in accent `#a855f7`**; a single faint scan-line sweeps the stack once (`svg-path-draw`, one pass) and a keyword glow (`asr-keyword-glow`) hits "forever"; holds still.

## Frame 3 — Shield: the mechanism

- scene: The truth flips. The XORR Deposit / "Shield public USDC" screen rises in; a USDC coin collapses into a single glowing commitment. Only the commitment stays on-chain; the amount dissolves.
- voiceover: "XORR changes that. Shield your USDC into a zero-knowledge note — only a commitment ever touches the chain. The amount stays invisible."
- duration: 12s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/03-shield.html
- type: product_intro
- persuasion: Show-don't-tell proof
- beat: relief + curiosity
- blueprint: cursor-ui-demo
- sfx: soft synth confirm
- asset_candidates: assets/app-deposit.png — the "Shield public USDC" card (amount + USDC coin + Shield button); assets/usdc.svg — USDC coin

narrativeRole: Name the product and show the core move — public USDC becomes a private note — the pivot from problem to solution.
keyMessage: XORR hides your money by turning it into a ZK note; only a commitment is public.

blueprint: cursor-ui-demo (Adapt — the real Deposit surface + a USDC→commitment handoff as the signature reveal) · focal: assets/app-deposit.png · roles: app-deposit = cutout (hero surface, right) · usdc.svg = supporting
Scene 1 (0.0–2.6s): "XORR changes that." — the dark canvas flips; the **app-deposit screenshot rises + tilts in as a 3D surface** (`3d-page-scroll`) to the right, depth-of-field blur (`depth-of-field-blur`) keeping the "Shield public USDC" card sharp; the headline sits left. Asymmetric 60/40, ≥3 depth layers, slow single push (`multi-phase-camera`).
Scene 2 (2.6–5.6s): "Shield your USDC into a zero-knowledge note" — a USDC coin (usdc.svg) lifts off the amount field and, on the cue, **scale-swaps (`scale-swap-transition`) into one glowing hexagonal commitment**; ambient glow bloom (`ambient-glow-bloom`) behind it.
Scene 3 (5.6–8.5s): "only a commitment ever touches the chain" — the commitment settles onto a thin on-chain rail while the amount digits blur and dissolve out (`depth-of-field-blur`); keyword glow (`asr-keyword-glow`) on "commitment".
Scene 4 (8.5–end): "the amount stays invisible" — hold: the shielded card reads "•••", the commitment glows on the rail; dead-still, subtle jitter only (a **breather** per Video direction).

## Frame 4 — Pay anyone, privately

- scene: The Pay & Receive screen; a recipient resolves through "email · @handle · Stellar address", the amount fills, and "Send privately" confirms — the sender↔receiver link fades out.
- voiceover: "Now pay anyone — by email, a handle, or any address. The link between you: hidden."
- duration: 8s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-pay.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation
- beat: ease + control
- blueprint: device-surface-showcase
- sfx: airy whoosh
- asset_candidates: assets/app-pay.png — Pay & Receive: recipient = email/@handle/address, "Send privately"

narrativeRole: First feature — pay real people, privately, with no crypto address gymnastics.
keyMessage: Send a private payment to anyone, by email or handle.

blueprint: device-surface-showcase (Reproduce) · focal: assets/app-pay.png · roles: app-pay = cutout (hero surface, centered)
Scene 1 (0.0–2.4s): "Now pay anyone" — the **Pay & Receive surface pushes in** (`3d-page-scroll`) centered ~70%, slow single push (`multi-phase-camera`), `power3`.
Scene 2 (2.4–4.6s): "by email, a handle, or any address" — the recipient field **cycles its token in place** (`discrete-text-sequence`, in-place token cycle): `alice@gmail.com` → `@alice` → `sb1…`, one swap per spoken item, velocity-matched.
Scene 3 (4.6–6.4s): a cursor glides to **"Send privately"** and clicks — press + ripple (`cursor-click-ripple` + `press-release-spring`).
Scene 4 (6.4–end): "The link between you: hidden" — a thin connector between two avatar dots **dissolves**; keyword glow (`asr-keyword-glow`) on "hidden"; holds still.

## Frame 5 — Bridge from Ethereum

- scene: Two grounds meet — Ethereum (Sepolia) on the left, Stellar on the right; USDC crosses as a proof seals the gap. "5 USDC → 4.995", "no on-chain link between deposit and claim."
- voiceover: "Bring USDC in from Ethereum — bridged with a proof, with no link between deposit and claim."
- duration: 8.5s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-bridge.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: confidence
- blueprint: comparison-split
- sfx: rising riser
- asset_candidates: assets/app-bridge.png — Bridge to xUSDC: Ethereum Sepolia → Stellar, Groth16; assets/xlm.svg — Stellar coin

narrativeRole: Second feature — your existing Ethereum USDC comes in, and privacy is preserved across the bridge.
keyMessage: Bridge USDC from Ethereum into private xUSDC, unlinkably.

blueprint: comparison-split (Adapt — Ethereum vs Stellar as split-tilt cards; USDC crossing + proof-seal is the signature) · focal: assets/app-bridge.png · roles: app-bridge = cutout (framed between the two sides) · xlm.svg = supporting (Stellar side)
Scene 1 (0.0–2.6s): "Bring USDC in from Ethereum" — two grounds enter from opposite wings as **split-tilt cards** (`split-tilt-cards`): Ethereum left (cool blue), Stellar right (purple), the app-bridge screenshot framed at center. Split-screen, ≥3 depth layers.
Scene 2 (2.6–5.2s): "bridged with a proof" — a USDC token **travels left→right across the seam** and a Groth16 proof glyph **draws itself** (`svg-path-draw`) sealing the gap; ambient glow bloom (`ambient-glow-bloom`) on the seal.
Scene 3 (5.2–end): "no link between deposit and claim" — the connecting thread between the two sides **cuts and vanishes**; the "5 → 4.995" figure settles; keyword glow (`asr-keyword-glow`) on "no link"; holds still (a held beat per Video direction).

## Frame 6 — Off-ramp to real fiat

- scene: The Off-ramp screen (Live anchor · SEP-24); XLM/USDC selector, then value flows Stellar → a fiat figure. "Straight to your bank."
- voiceover: "And cash out to real fiat — a live off-ramp, straight to your bank."
- duration: 7s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/06-offramp.html
- type: benefit_highlight
- persuasion: Feature-to-benefit translation
- beat: power + inevitability
- blueprint: device-surface-showcase
- sfx: warm success chime
- asset_candidates: assets/app-offramp.png — Off-ramp Stellar → fiat, real SEP-24 anchor

narrativeRole: Third feature + the payoff — this isn't a toy; the private money reaches your bank.
keyMessage: Real fiat off-ramp — private crypto that actually cashes out.

blueprint: device-surface-showcase (Reproduce) · focal: assets/app-offramp.png · roles: app-offramp = cutout (hero surface, centered)
Scene 1 (0.0–2.4s): "And cash out to real fiat" — the **Off-ramp (SEP-24) surface pushes in** (`3d-page-scroll`) centered, `power3`.
Scene 2 (2.4–4.4s): "a live off-ramp" — value **flows from the Stellar side to a fiat figure**; a counter ticks up to the fiat amount (`counting-dynamic-scale`) on the cue, and the SEP-24 **"completed" state lands in lime `#a6f24a`**.
Scene 3 (4.4–end): "straight to your bank" — a clean bank/fiat glyph resolves beside the figure (`svg-path-draw`); keyword glow (`asr-keyword-glow`) on "your bank"; holds still.

## Frame 7 — Proof + CTA

- scene: Feature surfaces clear off the edges; "proven in zero knowledge / verified on-chain" resolves, the XORR wordmark draws in, the tagline lands ("Private money, made real."), and the app URL — shield.xorr.finance — resolves beneath it in accent and holds as the final frame.
- voiceover: "Every spend — proven in zero knowledge, verified on-chain. XORR. Private money, made real."
- duration: 13s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/07-cta.html
- type: cta
- persuasion: Authority by association + Risk reversal
- beat: trust + inevitability
- blueprint: logo-assemble-lockup
- sfx: cinematic brand swell
- asset_candidates: assets/logo.png — XORR wordmark

narrativeRole: Land the trust (real ZK, on-chain) and close on the brand + tagline.
keyMessage: XORR — private money, made real, and provably so.

blueprint: logo-assemble-lockup (Reproduce — surfaces clear off-edge, the wordmark draws on, lockup completes) · focal: assets/logo.png · roles: logo = cutout (hero, centered)
Scene 1 (0.0–3.0s): "Every spend — proven in zero knowledge" — the prior feature surfaces **clear off all four edges** (reverse cluster→outward, `center-outward-expansion`); "proven in zero knowledge" assembles per-word (`dynamic-content-sequencing`), `power3`.
Scene 2 (3.0–5.0s): "verified on-chain" — a small proof/chain glyph **draws itself** (`svg-path-draw`); keyword glow (`asr-keyword-glow`) on "verified on-chain".
Scene 3 (5.0–8.0s): beat of stillness, then **"XORR"** — the XORR wordmark (logo.png) resolves dead-center with an ambient glow bloom (`ambient-glow-bloom`), smooth settle (`power3`). Centered climax ~50%.
Scene 4 (8.0–end): "Private money, made real." — the tagline reveals beneath the wordmark; then **`shield.xorr.finance` resolves below it in accent `#a855f7`** (per-word, `dynamic-content-sequencing`). Final frame — holds long and still as the read; subtle jitter (`sine-wave-loop`, low) only.
