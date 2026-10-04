# Frame-worker brief — XORR 60s launch (shared)

You build **ONE** HyperFrames frame (a self-contained HTML sub-composition) and nothing else.

- **PROJECT_DIR**: `/Volumes/Extreme SSD/Projects/stellar/videos/xorr-launch` (all paths relative to it)
- **Canvas**: 1920×1080 landscape
- **Captions**: ENABLED — a karaoke pill owns the bottom ~17%. **Keep every element in the top ~83% (y ≤ 900px). Nothing below y=900.**
- **RULES_DIR**: `/Users/jaibajrang/.claude/skills/hyperframes-animation/rules`

## READ FIRST (in order — these encode framework rules not in general web docs)
1. Frame-worker contract: `/Users/jaibajrang/.claude/skills/product-launch-video/sub-agents/frame-worker.md`
2. Composition structural law: `/Users/jaibajrang/.claude/skills/hyperframes-core/references/minimal-composition.md`, `sub-compositions.md`, `data-attributes.md`, `determinism-rules.md`
3. Design truth: `PROJECT_DIR/frame.md` (palette / type ramp / components — pull EVERY token from here)
4. Your `## Frame <N>` block in `PROJECT_DIR/STORYBOARD.md` (your build spec: the time-coded Scene lines + `blueprint:` / `focal:` / `roles:` / assets) **and** the `## Video direction` block at the top (shared invariants — obey them)
5. Your blueprint: `/Users/jaibajrang/.claude/skills/hyperframes-animation/blueprints/<BLUEPRINT>.md` (keep its signature move recognizable)
6. The rule recipe for EVERY named motion in your Scene lines: `RULES_DIR/<motion-id>.md` (reproduce the mechanics — never name-guess)
7. Cut catalog (within-frame seams): `/Users/jaibajrang/.claude/skills/product-launch-video/references/cut-catalog.md`

## BRAND (dark theme — from frame.md)
Canvas `#0d0d0f` · text `#ffffff` · muted `#a1a1aa` · **accent `#a855f7` (purple)** carries eyebrows / keyword-glows / the payoff word / the URL · `#e2a9f1` (soft lavender) secondary · **`#a6f24a` (lime)** the single success note. Cards = subtle white tint (4% white fill / 12% white border), **no heavy shadow** — like the XORR app. Type: **Poppins only**.

## FONTS — paste these `@font-face` rules INSIDE your `<template>` (files exist at these root-relative paths):
```css
@font-face{font-family:"Poppins";font-style:normal;font-weight:400;font-display:block;src:url("assets/fonts/poppins-400.woff2") format("woff2");}
@font-face{font-family:"Poppins";font-style:normal;font-weight:500;font-display:block;src:url("assets/fonts/poppins-500.woff2") format("woff2");}
@font-face{font-family:"Poppins";font-style:normal;font-weight:600;font-display:block;src:url("assets/fonts/poppins-600.woff2") format("woff2");}
@font-face{font-family:"Poppins";font-style:normal;font-weight:700;font-display:block;src:url("assets/fonts/poppins-700.woff2") format("woff2");}
```

## HARD RULES (self-check before finishing — you CANNOT run the CLI)
- Root is `<template>`-wrapped, carries `data-composition-id="<frame_id>"`. **Style the root via `#root`** — never a class on the root element. **ALL `<style>` + `<script>` (incl. the GSAP CDN load) live INSIDE `<template>`.**
- The full-bleed dark background rides on a **`class="clip"` background layer** (with `data-start`/`data-duration`/`data-track-index`), **NOT** on `#root`.
- Exactly one `gsap.timeline({ paused: true })`, registered at `window.__timelines["<frame_id>"]`, built synchronously.
- Every `class="clip"` element has `data-start`, `data-duration`, `data-track-index`. **Entrances use `fromTo`** (never CSS-hidden starts). Hero visible by `t ≤ 0.5s`.
- **Motion: smooth `power3` long-tail ONLY — NO `back`/`bounce`/`elastic`.** No CSS `transition`/`@keyframes` for motion. No `repeat`/`yoyo`. No `Math.random`/`Date.now`. Do NOT put a CSS `transform` on an element you then GSAP-tween a transform on (use `fromTo` / `xPercent` / margins).
- **No exit tween** (a non-final frame unmounts via the root transition). **Exception: frame `07-cta` IS the final frame** — it may end on a quiet settle.
- **Do NOT front-load.** Reveal each piece on its voiceover cue across the FULL `duration` (follow your Scene times). **End on a held read** — at most subtle low-amplitude jitter (`sine-wave-loop`); no lazy breathing, no back-half pan/push.
- **Visible text is SHORT** motion-graphics copy (a headline / one-word emphasis) — **NEVER a full narration sentence** (captions render the spoken words separately). Do NOT lift copy from `frame.md`.
- Assets: a screenshot → `<img class="clip">` placed per its `role` (a `cutout` is a foreground surface — lay text around it, respect the 83% keep-out). Reference by `assets/<name>`.

## OUTPUT
Write ONLY `PROJECT_DIR/compositions/frames/<frame_id>.html`. Do NOT run any CLI, do NOT edit `STORYBOARD.md`, do NOT touch other files. Writing the file is your terminal action.
