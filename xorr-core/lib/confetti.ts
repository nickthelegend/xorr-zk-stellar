// Consumer-grade success flourish. Used on confirmed transactions, claims,
// bridges and swaps. No-op safe on the server.
import confetti from "canvas-confetti";

const COLORS = ["#a6f24a", "#ffffff", "#7c4dff", "#22d3ee"];

/** A single celebratory burst from the lower-center. */
export function burst() {
  if (typeof window === "undefined") return;
  confetti({ particleCount: 120, spread: 78, startVelocity: 42, origin: { y: 0.65 }, colors: COLORS });
}

/** A short two-cannon shower (for big moments like Bridge Completed). */
export function celebrate(durationMs = 1100) {
  if (typeof window === "undefined") return;
  const end = Date.now() + durationMs;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, startVelocity: 45, origin: { x: 0 }, colors: COLORS });
    confetti({ particleCount: 5, angle: 120, spread: 60, startVelocity: 45, origin: { x: 1 }, colors: COLORS });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
