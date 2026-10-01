#!/usr/bin/env bash
# Fresh build + fresh data + real server + Chromium end-to-end run.
set -e
cd "$(dirname "$0")/.."
pkill -f "tsx server/index.ts" 2>/dev/null || true
rm -rf server/data e2e/shots
npm run build >/dev/null
PORT=${PORT:-8787} npx tsx server/index.ts >/tmp/busly-server.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf server/data' EXIT
for i in $(seq 1 30); do curl -sf "localhost:${PORT:-8787}/api/health" >/dev/null && break; sleep 0.5; done
node e2e/run.mjs
node e2e/auth.mjs
node e2e/responsive.mjs
