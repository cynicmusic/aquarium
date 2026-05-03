#!/usr/bin/env bash
# Build the chromatophore workshop and rsync it to the DreamHost /chroma/ path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$(mktemp -d -t chroma-deploy.XXXXXX)"
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

REMOTE_DIR="$DREAMHOST_REMOTE_ROOT/chroma"
URL="${DREAMHOST_URL%/}/chroma/"
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
cp dist/chromatophore-workshop.html "$DEPLOY/index.html"
cp -R dist/assets "$DEPLOY/assets"

ssh "${SSH_OPTS[@]}" "$DREAMHOST_USER@$DREAMHOST_HOST" "mkdir -p ~/$REMOTE_DIR && chmod 755 ~/$REMOTE_DIR"

echo "-> rsync -> $DREAMHOST_USER@$DREAMHOST_HOST:~/$REMOTE_DIR/"
rsync -az --delete --no-perms --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e "ssh ${SSH_OPTS[*]}" "$DEPLOY/" \
  "$DREAMHOST_USER@$DREAMHOST_HOST:~/$REMOTE_DIR/"

echo "-> verify"
CODE=$(curl -L -s -o /dev/null -w "%{http_code}" "$URL")
if [ "$CODE" != "200" ]; then
  echo "site returned HTTP $CODE for $URL" >&2
  exit 1
fi
echo "ok $URL -> HTTP 200"

open "$URL"
