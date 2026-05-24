#!/bin/sh
set -e

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) echo "Windows is not supported. Use WSL."; exit 1 ;;
esac

if ! command -v node > /dev/null 2>&1; then
  echo "node is not installed. Install Node.js first: https://nodejs.org"
  exit 1
fi

INSTALL_DIR="$HOME/.F/src"
mkdir -p "$INSTALL_DIR"

BASE_URL="https://raw.githubusercontent.com/AbhiShake1/F/main"
for f in index.js detect.js frecency.js fetch.js read.js search.js setup.js; do
  curl -fsSL "$BASE_URL/$f" -o "$INSTALL_DIR/$f"
done

WRAPPER='#!/bin/sh
exec node "$HOME/.F/src/index.js" "$@"'

BIN_PATH="/usr/local/bin/F"
LOCAL_BIN=""
if ! printf '%s\n' "$WRAPPER" > "$BIN_PATH" 2>/dev/null; then
  LOCAL_BIN="$HOME/.local/bin"
  mkdir -p "$LOCAL_BIN"
  BIN_PATH="$LOCAL_BIN/F"
  printf '%s\n' "$WRAPPER" > "$BIN_PATH"
fi

chmod +x "$BIN_PATH"

echo "F installed. Run: F -s"
if [ -n "$LOCAL_BIN" ]; then
  echo "Add \$HOME/.local/bin to PATH if not already there."
fi
