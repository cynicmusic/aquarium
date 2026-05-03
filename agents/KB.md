# Aquarium KB

## Publish Standard

The current DreamHost target for this repo is the `claudeaquarium` shell user. Keep deploy credentials in the local `.env` file and keep `.env` ignored by git.

Required `.env` keys:

```sh
DREAMHOST_USER=claudeaquarium
DREAMHOST_PASSWORD=...
DREAMHOST_HOST=aquarium.relaxmoods.com
DREAMHOST_REMOTE_ROOT=aquarium.relaxmoods.com
DREAMHOST_URL=https://aquarium.relaxmoods.com/
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

If `aquarium.relaxmoods.com` DNS has not propagated, `DREAMHOST_HOST=relaxmoods.com` is the preferred fallback while keeping `DREAMHOST_REMOTE_ROOT=aquarium.relaxmoods.com` and `DREAMHOST_URL=https://aquarium.relaxmoods.com/`. Do not retry password login attempts.
