# Asset inventory — XORR launch

Real frontend screenshots captured from the live app (dark UI, headless Chrome @2x, dev badge
cropped off). Staged in `capture/assets/`.

| Asset | File | What it shows |
|-------|------|---------------|
| App — Deposit / Shield | `app-deposit.png` | The "Shield public USDC" card: amount input with the USDC coin logo + a "Shield" button, and the line "a ZK proof binds the note's secret value… the amount itself never appears." The core privacy action. |
| App — Pay & Receive | `app-pay.png` | "Pay & Receive" with a Send/Receive toggle, a recipient field placeholder **"email, @handle, or Stellar address"** (e.g. alice@gmail.com / @alice / sb1…), an amount, and a **"Send privately"** button. The pay-anyone feature. |
| App — Bridge to xUSDC | `app-bridge.png` | "Bridge to xUSDC": **From Ethereum Sepolia (5 USDC) → To Stellar Testnet (4.995)** with a Groth16 badge and "no on-chain link between deposit and claim." The ETH→Stellar bridge. |
| App — Off-ramp (SEP-24) | `app-offramp.png` | "Off-ramp — Stellar → fiat": the **Live anchor · SEP-24** tab, an XLM/USDC asset selector (real coin logos), amount, and "Anchor limits". The real fiat off-ramp. |
| App — Money Market | `app-market.png` | "XORR Money Market": $3M supplied, market cards for USDC (6.51% / 13.08%) and XLM with utilization bars + a supply/borrow panel. Bonus feature. |
| Logo | `logo.png` | The XORR "Xorr" wordmark — transparent purple gradient PNG (741×226). Primary branding. |
| Token — USDC | `usdc.svg` | The USDC brand coin (blue). For the "shield / how-it-works" graphics. |
| Token — XLM | `xlm.svg` | The Stellar/XLM brand coin (black glyph). For bridge / off-ramp graphics. |

Brand: dark #101010 canvas, purple accents #a855f7 / #e2a9f1 / #7c3aed, lime #a6f24a, Poppins.
No other captured assets — the "how it works" ZK-note visual (commitment / nullifier / on-chain
proof) is authored as designed typography/graphics, not a screenshot.
