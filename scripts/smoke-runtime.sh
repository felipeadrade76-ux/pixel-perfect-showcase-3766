#!/usr/bin/env bash
set -euo pipefail

# Runs only against the built app and dummy CI keys. No live cloud services.
test -f .output/server/index.mjs

export PORT="${PORT:-4173}"
export HOST="127.0.0.1"
log="$(mktemp)"
root="$(mktemp)"
login="$(mktemp)"
node .output/server/index.mjs >"$log" 2>&1 &
pid=$!
cleanup() { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; rm -f "$log" "$root" "$login"; }
trap cleanup EXIT

ready=0
for attempt in $(seq 1 40); do
  if curl --silent --show-error --fail "http://127.0.0.1:$PORT/" >"$root" 2>/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "Independent SSR server failed to become ready" >&2
  cat "$log" >&2
  exit 1
fi

grep -q 'Ritmeia' "$root" || {
  echo "SSR did not render the expected app title" >&2
  cat "$log" >&2
  exit 1
}
curl --silent --show-error --fail "http://127.0.0.1:$PORT/login" >"$login"
if grep -q 'Lovable App' "$root"; then
  echo "Legacy editor branding unexpectedly rendered" >&2
  exit 1
fi
echo INDEPENDENT_NODE_RUNTIME_SMOKE_PASSED
