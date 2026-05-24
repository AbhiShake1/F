#!/bin/sh
set -e

case "$(uname -s)" in
  Darwin|Linux) ;;
  *) echo "Windows is not supported. Use WSL or run install.ps1 in PowerShell."; exit 1 ;;
esac

if ! command -v node > /dev/null 2>&1; then
  echo "node is not installed. Install Node.js first: https://nodejs.org"
  exit 1
fi

# Download source files
INSTALL_DIR="$HOME/.F/src"
mkdir -p "$INSTALL_DIR"
BASE_URL="https://raw.githubusercontent.com/AbhiShake1/F/main"
for f in index.js detect.js frecency.js fetch.js read.js search.js setup.js cloak_fetch.js; do
  curl -fsSL "$BASE_URL/$f" -o "$INSTALL_DIR/$f"
done

WRAPPER='#!/bin/sh
exec node "$HOME/.F/src/index.js" "$@"'

# Detect existing install location and update in place, or pick a new one
EXISTING="$(command -v F 2>/dev/null || true)"
if [ -n "$EXISTING" ] && [ -w "$EXISTING" ]; then
  BIN_PATH="$EXISTING"
elif [ -w /usr/local/bin ]; then
  BIN_PATH="/usr/local/bin/F"
elif [ -w "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
  BIN_PATH="$HOME/.local/bin/F"
else
  echo "cannot write to a bin directory. try: sudo curl -fsSL $BASE_URL/install.sh | sh"
  exit 1
fi

printf '%s\n' "$WRAPPER" > "$BIN_PATH"
chmod +x "$BIN_PATH"

if [ -n "$EXISTING" ]; then
  echo "F updated."
else
  echo "F installed. Run: F -s"
  case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) [ "$BIN_PATH" = "$HOME/.local/bin/F" ] && echo "Add \$HOME/.local/bin to PATH if not already there." ;;
  esac
fi
