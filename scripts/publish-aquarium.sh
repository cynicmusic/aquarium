#!/usr/bin/env bash
# Build the main aquarium as static files and rsync the root app pieces to
# the DreamHost web root. This intentionally does not --delete the remote root
# because /cuttlefish/ is managed by publish-cuttlefish.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(mktemp -d -t aquarium-deploy.XXXXXX)"
trap 'rm -rf "$DEPLOY"' EXIT

if [ ! -f "$ROOT/.env" ]; then
  echo "Missing $ROOT/.env; see agents/KB.md for the DreamHost deploy standard." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

: "${DREAMHOST_USER:?Missing DREAMHOST_USER in .env}"
: "${DREAMHOST_HOST:?Missing DREAMHOST_HOST in .env}"
: "${DREAMHOST_REMOTE_ROOT:?Missing DREAMHOST_REMOTE_ROOT in .env}"
: "${DREAMHOST_URL:?Missing DREAMHOST_URL in .env}"
: "${DREAMHOST_SSH_KEY:?Missing DREAMHOST_SSH_KEY in .env}"

SSH_OPTS=(
  -i "$DREAMHOST_SSH_KEY"
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o PreferredAuthentications=publickey
  -o PasswordAuthentication=no
  -o ConnectTimeout=10
)

cd "$ROOT"

echo "-> vite build (base=./)"
rm -rf dist
npx vite build --base=./ >/dev/null

echo "-> assembling deploy payload at $DEPLOY"
cp dist/index.html "$DEPLOY/index.html"
cp -R dist/assets "$DEPLOY/assets"
cp -R dist/fish "$DEPLOY/fish"

echo "-> rsync -> $DREAMHOST_USER@$DREAMHOST_HOST:~/$DREAMHOST_REMOTE_ROOT/"
rsync -az --no-perms --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "ssh ${SSH_OPTS[*]}" "$DEPLOY/" \
  "$DREAMHOST_USER@$DREAMHOST_HOST:~/$DREAMHOST_REMOTE_ROOT/"

echo "-> verify"
CODE=$(curl -L -s -o /dev/null -w "%{http_code}" "$DREAMHOST_URL")
if [ "$CODE" != "200" ]; then
  echo "site returned HTTP $CODE for $DREAMHOST_URL" >&2
  exit 1
fi
echo "ok $DREAMHOST_URL -> HTTP 200"

open "$DREAMHOST_URL"
