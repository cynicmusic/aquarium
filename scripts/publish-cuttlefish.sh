#!/usr/bin/env bash
# Build the cuttlefish preview as static files and rsync to
# staging.relaxmoods.com/cuttlefish/. No args, no flags — one shot.
#
#   ./scripts/publish-cuttlefish.sh
#
# Requires: SSH key auth for claudecoder@vps48807.dreamhostps.com,
#           python3 with qrcode[pil] for the QR pop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(mktemp -d -t cuttlefish-deploy.XXXXXX)"
trap 'rm -rf "$DEPLOY"' EXIT

REMOTE_USER="claudecoder"
REMOTE_HOST="vps48807.dreamhostps.com"
REMOTE_DIR="staging.relaxmoods.com/cuttlefish"
URL="https://staging.relaxmoods.com/cuttlefish/"

cd "$ROOT"

echo "→ vite build (base=./)"
rm -rf dist
npx vite build --base=./ >/dev/null

echo "→ assembling deploy payload at $DEPLOY"
cp dist/cuttlefish-preview.html "$DEPLOY/index.html"
cp -R dist/assets "$DEPLOY/assets"
cp -R dist/fish   "$DEPLOY/fish"

echo "→ rsync → $REMOTE_USER@$REMOTE_HOST:~/$REMOTE_DIR/"
rsync -az --delete --no-perms "$DEPLOY/" \
  "$REMOTE_USER@$REMOTE_HOST:~/$REMOTE_DIR/"

echo "→ verify"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$CODE" != "200" ]; then
  echo "✗ staging returned HTTP $CODE for $URL" >&2
  exit 1
fi
echo "✓ $URL → HTTP 200"

echo "→ popping browser + QR"
open "$URL"
python3 - <<PY || echo "  (QR skipped — install: pip3 install 'qrcode[pil]')"
import qrcode, subprocess, tempfile, os
img = qrcode.make("$URL")
p = os.path.join(tempfile.gettempdir(), "cuttlefish_qr.png")
img.save(p)
subprocess.run(["open", p])
PY
