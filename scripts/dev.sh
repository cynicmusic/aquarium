#!/usr/bin/env bash
# Start the Vite dev server (if not running) and block while it runs.
# Used by launch-aquarium.sh / launch-workshop.sh.

set -e
cd "$(dirname "$0")/.."

PORT=3456

if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "[dev.sh] Vite already listening on :$PORT"
else
  echo "[dev.sh] Starting Vite on :$PORT..."
  npm run dev
fi
