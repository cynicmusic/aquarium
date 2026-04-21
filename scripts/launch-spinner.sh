#!/usr/bin/env bash
# Launch the fish-spinner viewer for isolated fish iteration.
set -e
DIR="$(dirname "$0")"
"$DIR/ensure-dev.sh"
open "http://localhost:3456/fish-spinner.html"
