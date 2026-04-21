#!/usr/bin/env bash
# Launch the fullscreen chromatophore workshop in the default browser.
set -e
DIR="$(dirname "$0")"
"$DIR/ensure-dev.sh"
open "http://localhost:3456/chromatophore-workshop.html"
