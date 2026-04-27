#!/usr/bin/env bash
# Build the main aquarium as static files and rsync the root app pieces to
# staging.relaxmoods.com/. This intentionally does not --delete the remote root
# because /cuttlefish/ is managed by publish-cuttlefish.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(mktemp -d -t aquarium-deploy.XXXXXX)"
trap 'rm -rf "$DEPLOY"' EXIT

REMOTE_USER="claudecoder"
REMOTE_HOST="vps48807.dreamhostps.com"
REMOTE_DIR="staging.relaxmoods.com"
URL="https://staging.relaxmoods.com/"

cd "$ROOT"

echo "-> vite build (base=./)"
rm -rf dist
npx vite build --base=./ >/dev/null

echo "-> assembling deploy payload at $DEPLOY"
cp dist/index.html "$DEPLOY/index.html"
cp -R dist/assets "$DEPLOY/assets"
cp -R dist/fish "$DEPLOY/fish"

echo "-> rsync -> $REMOTE_USER@$REMOTE_HOST:~/$REMOTE_DIR/"
rsync -az --no-perms "$DEPLOY/" \
  "$REMOTE_USER@$REMOTE_HOST:~/$REMOTE_DIR/"

echo "-> verify"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$CODE" != "200" ]; then
  echo "staging returned HTTP $CODE for $URL" >&2
  exit 1
fi
echo "ok $URL -> HTTP 200"

open "$URL"
