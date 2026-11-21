#!/usr/bin/env bash
# Worker E verification loop: restart the integrated demo from the current checkout and run both suites.
#   bash docs-verify/run.sh            # restart `pnpm demo`, run vitest acceptance + Playwright
#   NO_RESTART=1 bash docs-verify/run.sh
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
OUT=data/verify-out; # not test-results/: Playwright wipes it mkdir -p "$OUT"
URL="${CS_BASE_URL:-http://localhost:3000}"
if [ "${NO_RESTART:-}" != "1" ]; then
  for port in 3000 8545; do lsof -ti ":$port" | xargs kill 2>/dev/null || true; done
  sleep 1
  rm -f data/*.db data/*.db-* data/deployment.json
  (DEV="${DEV:-}" nohup pnpm demo > "$OUT/demo.log" 2>&1 &)
  for _ in $(seq 1 180); do curl -sf "$URL/api/health" >/dev/null && break; sleep 1; done
fi
echo "health: $(curl -s "$URL/api/health")"
echo "tested HEAD: $(git rev-parse --short HEAD)  origin/main: $(git rev-parse --short origin/main)"
ACCEPTANCE=1 CS_BASE_URL="$URL" pnpm exec vitest run tests/acceptance --reporter=default --reporter=json --outputFile="$OUT/acceptance.json" > "$OUT/acceptance.log" 2>&1
echo "vitest exit $?"
BASE_URL="$URL" pnpm exec playwright test > "$OUT/e2e.log" 2>&1
echo "playwright exit $?"
node docs-verify/summary.mjs
