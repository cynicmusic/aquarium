#!/usr/bin/env bash
# Install the local deploy public key on DreamHost with one password SSH attempt.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/.env" ]; then
  echo "Missing $ROOT/.env; see agents/KB.md for the DreamHost deploy standard." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

: "${DREAMHOST_USER:?Missing DREAMHOST_USER in .env}"
: "${DREAMHOST_PASSWORD:?Missing DREAMHOST_PASSWORD in .env}"
: "${DREAMHOST_HOST:?Missing DREAMHOST_HOST in .env}"
: "${DREAMHOST_SSH_KEY:?Missing DREAMHOST_SSH_KEY in .env}"

if [ ! -f "$DREAMHOST_SSH_KEY" ]; then
  mkdir -p "$(dirname "$DREAMHOST_SSH_KEY")"
  ssh-keygen -t ed25519 -f "$DREAMHOST_SSH_KEY" -N "" \
    -C "$DREAMHOST_USER@$DREAMHOST_HOST aquarium deploy"
fi

chmod 600 "$DREAMHOST_SSH_KEY"
chmod 644 "$DREAMHOST_SSH_KEY.pub"

if ! command -v expect >/dev/null 2>&1; then
  echo "Missing expect; cannot safely automate the one password attempt." >&2
  exit 1
fi

host_resolves() {
  if command -v getent >/dev/null 2>&1; then
    getent hosts "$DREAMHOST_HOST" >/dev/null 2>&1
  elif command -v dscacheutil >/dev/null 2>&1; then
    dscacheutil -q host -a name "$DREAMHOST_HOST" | grep -Eq '^(ip_address|ipv6_address):'
  else
    return 1
  fi
}

if ! host_resolves; then
  echo "Host $DREAMHOST_HOST does not resolve yet; no login attempt was made." >&2
  exit 2
fi

quote_for_remote() {
  printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

PUB_KEY="$(cat "$DREAMHOST_SSH_KEY.pub")"
REMOTE_CMD="umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; grep -qxF $(quote_for_remote "$PUB_KEY") ~/.ssh/authorized_keys || printf '%s\n' $(quote_for_remote "$PUB_KEY") >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
export DREAMHOST_REMOTE_CMD="$REMOTE_CMD"

echo "Making exactly one password SSH attempt to install the deploy key."
expect <<'EXPECT'
set timeout 30
set sent_password 0
spawn ssh \
  -o NumberOfPasswordPrompts=1 \
  -o PreferredAuthentications=password,keyboard-interactive \
  -o PubkeyAuthentication=no \
  -o StrictHostKeyChecking=accept-new \
  $env(DREAMHOST_USER)@$env(DREAMHOST_HOST) \
  $env(DREAMHOST_REMOTE_CMD)

expect {
  -re "(?i)password:" {
    if {$sent_password == 1} {
      exit 12
    }
    set sent_password 1
    send -- "$env(DREAMHOST_PASSWORD)\r"
    exp_continue
  }
  eof {
    catch wait result
    exit [lindex $result 3]
  }
  timeout {
    exit 11
  }
}
EXPECT

echo "Deploy key installed. Future publish commands use key-only SSH."
