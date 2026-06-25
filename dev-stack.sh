#!/usr/bin/env bash
# Boot the local services the XORR app depends on for FULL (multi-user) mode.
#
#   relayer   :8790  cross-chain bridge (ETH↔Stellar) — forward mint + reverse release
#   delivery  :8787  encrypted note delivery + handle registry + global leaf indexer
#                    + off-ramp (MongoDB-backed) → enables cross-user Send/Receive,
#                    Pay-to-handle/email, and the off-ramp
#   keeper    :8791  lending money-market keeper — relays the live oracle price
#                    (median of CEX feeds) + auto-liquidates underwater positions
#   (dev)     :3000  the Next.js app — run separately: `cd xorr-core && npm run dev`
#
# Without these two services the app falls back to SINGLE-USER mode (you only see
# your own notes) and the in-app bridge can't mint/release. Mongo must be running
# (brew services start mongodb-community).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGDIR="${TMPDIR:-/tmp}"

echo "▸ checking MongoDB (delivery backend needs it)…"
if ! (echo > /dev/tcp/localhost/27017) >/dev/null 2>&1; then
  echo "  ⚠ MongoDB not reachable on :27017 — start it: brew services start mongodb-community"
  echo "    (cross-user delivery + off-ramp need it; the bridge does not)"
fi

start() { # name dir port cmd...
  local name="$1" dir="$2" port="$3"; shift 3
  if curl -s --max-time 2 "localhost:$port/health" >/dev/null 2>&1; then
    echo "▸ $name already up on :$port ✓"; return
  fi
  pkill -f "$1-pidtag" 2>/dev/null || true
  echo "▸ starting $name on :$port …"
  ( cd "$ROOT/$dir" && nohup "$@" > "$LOGDIR/xorr-$name.log" 2>&1 & disown )
}

start relayer  "xorr-stellar-contracts/eth"   8790 node relayer/relayer.mjs
start delivery "stellar-privacy/backend"      8787 npm start
start keeper   "xorr-stellar-contracts/eth"   8791 node lending-keeper/keeper.mjs

echo "▸ waiting for health…"
for i in $(seq 1 20); do
  r=$(curl -s --max-time 2 localhost:8790/health -o /dev/null -w '%{http_code}' || echo 000)
  d=$(curl -s --max-time 2 localhost:8787/health -o /dev/null -w '%{http_code}' || echo 000)
  k=$(curl -s --max-time 2 localhost:8791/health -o /dev/null -w '%{http_code}' || echo 000)
  [ "$r" = "200" ] && [ "$d" = "200" ] && [ "$k" = "200" ] && break
  sleep 1
done
echo ""
echo "  relayer  :8790 -> $(curl -s --max-time 2 localhost:8790/health || echo DOWN)"
echo "  delivery :8787 -> $(curl -s --max-time 2 localhost:8787/health || echo DOWN)"
echo "  keeper   :8791 -> $(curl -s --max-time 2 localhost:8791/health || echo DOWN)"
echo ""
echo "✓ stack up. Now run the app:  cd xorr-core && npm run dev   (→ http://localhost:3000)"
echo "  logs: $LOGDIR/xorr-relayer.log  $LOGDIR/xorr-delivery.log"
