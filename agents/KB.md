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
./scripts/publish-chroma.sh
```

`publish-aquarium.sh` updates the root aquarium and does not delete the remote root, so `/cuttlefish/` and `/chroma/` remain intact. `publish-cuttlefish.sh` updates `/cuttlefish/` with `--delete` inside that subdirectory only. `publish-chroma.sh` updates `/chroma/` with `--delete` inside that subdirectory only.

Published routes:

- `/` is the standard aquarium and links back to `/cuttlefish/`.
- `/cuttlefish/` uses `cuttlefish-publish.html`, which intentionally has no params-panel markup. It keeps the FPS readout and camera selector. Local tuning still uses `cuttlefish-preview.html` with the full params panel.
- `/chroma/` is the chromatophore workshop and is linked as `chroma` from `/cuttlefish/`.

Final cleanup state:

- 2026-05-03 final publish: `https://aquarium.relaxmoods.com/`, `/cuttlefish/`, and `/chroma/` all verified HTTP 200 after key-only deploy.
- The standard aquarium was restored as the public root and the removed holo tetra / holo fish additions should stay out.
- Audio/music code and MP3 handling are removed from the project.
- The stale root `prompt.txt` and `plan.md` scratch files are removed.
- The repo is considered finished unless a new feature request reopens it.

If `aquarium.relaxmoods.com` DNS has not propagated, `DREAMHOST_HOST=relaxmoods.com` is the preferred fallback while keeping `DREAMHOST_REMOTE_ROOT=aquarium.relaxmoods.com` and `DREAMHOST_URL=https://aquarium.relaxmoods.com/`. Do not retry password login attempts.
