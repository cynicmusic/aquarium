#!/usr/bin/env bash
# Launch the main 3D aquarium designer in the default browser.
set -e
DIR="$(dirname "$0")"
"$DIR/ensure-dev.sh"
open "http://localhost:3456/"
