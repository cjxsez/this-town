#!/usr/bin/env bash
# Screenshot a route at phone size with headless Chrome.
#   scripts/shot.sh http://localhost:5171/screens/B2 out.png
# Headless Chrome won't go narrower than ~500px, so the 430px app column sits
# centred with a strip of page colour either side; that is expected.
set -euo pipefail
url="$1"; out="$2"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=500,932 --virtual-time-budget=3000 \
  --screenshot="$out" "$url" >/dev/null 2>&1
echo "$out"
