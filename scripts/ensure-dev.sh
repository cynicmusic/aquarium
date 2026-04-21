#!/usr/bin/env bash
# Start vite in the background if it isn't running, and wait until it serves.
# Exits 0 once the server responds (caller can then open URLs).

set -e
cd "$(dirname "$0")/.."

PORT=3456
URL="http://localhost:$PORT"

if ! lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  mkdir -p logs
  echo "[ensure-dev] Starting vite..."
  nohup npm run dev >logs/vite.log 2>&1 &
  disown
fi

# Wait up to 20s for server to respond.
for i in $(seq 1 40); do
  if curl -sSf -o /dev/null "$URL/"; then
    echo "[ensure-dev] vite ready at $URL"
    exit 0
  fi
  sleep 0.5
done

echo "[ensure-dev] ERROR: vite did not come up on $URL" >&2
exit 1
