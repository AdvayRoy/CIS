#!/usr/bin/env bash
# One-command CounterSign demo: private Anvil + deploy + Next.js on :3000.
#   pnpm demo            production build + start
#   DEV=1 pnpm demo      dev server
#   pnpm demo:reset      (separate script) wipe ledger + redeploy chain state
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
PORT="${PORT:-3000}"
export ANVIL_RPC_URL="${ANVIL_RPC_URL:-http://127.0.0.1:8545}"
mkdir -p data
rpc_up() { curl -s -o /dev/null -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$ANVIL_RPC_URL"; }
ANVIL_PID=""
if rpc_up; then echo "[demo] reusing Anvil at $ANVIL_RPC_URL"
elif command -v anvil >/dev/null; then
  anvil --host 127.0.0.1 --port 8545 > data/anvil.log 2>&1 & ANVIL_PID=$!
  for _ in $(seq 1 50); do rpc_up && break; sleep 0.2; done
  echo "[demo] Anvil started (pid $ANVIL_PID), bound to 127.0.0.1 only"
else echo "[demo] anvil not found: crypto rail will show as unavailable (install Foundry)"; fi
trap '[ -n "$ANVIL_PID" ] && kill "$ANVIL_PID" 2>/dev/null || true' EXIT
if rpc_up && [ -f scripts/chain/deploy.ts ]; then pnpm tsx scripts/chain/deploy.ts; fi
if [ "${DEV:-}" = "1" ]; then pnpm next dev -p "$PORT"; else pnpm next build && pnpm next start -p "$PORT"; fi
