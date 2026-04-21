#!/usr/bin/env bash
# Launch the interactive 3D cuttlefish preview.
set -e
DIR="$(dirname "$0")"
"$DIR/ensure-dev.sh"
open "http://localhost:3456/cuttlefish-preview.html"
