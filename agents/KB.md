# Aquarium KB

## Publish Standard

The current DreamHost target for this repo is the `claudeaquarium` shell user. Keep deploy credentials in the local `.env` file and keep `.env` ignored by git.

Required `.env` keys:

```sh
DREAMHOST_USER=claudeaquarium
DREAMHOST_PASSWORD=...
DREAMHOST_HOST=claudeaquarium.com
DREAMHOST_REMOTE_ROOT=claudeaquarium.com
DREAMHOST_URL=https://claudeaquarium.com/
DREAMHOST_SSH_KEY="$HOME/.ssh/dreamhost_claudeaquarium_ed25519"
```

Setup flow:

1. Run `./scripts/setup-dreamhost-ssh.sh` once.
2. That script creates the local deploy key if needed and makes exactly one password SSH attempt to append the public key to DreamHost.
3. After that, publish scripts use key-only SSH with password auth disabled.

Publish commands:

```sh
./scripts/publish-aquarium.sh
./scripts/publish-cuttlefish.sh
```

`publish-aquarium.sh` updates the root aquarium and does not delete the remote root, so `/cuttlefish/` remains intact. `publish-cuttlefish.sh` updates `/cuttlefish/` with `--delete` inside that subdirectory only.

If DNS has not propagated, update `DREAMHOST_HOST` to the server hostname from DreamHost panel. Do not guess and do not retry password login attempts.
