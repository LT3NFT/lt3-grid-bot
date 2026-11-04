#!/usr/bin/env bash
# Run ON the VM:
#   curl -sL https://raw.githubusercontent.com/LT3NFT/lt3-grid-bot/main/scripts/vm-deploy.sh | bash
# Fast code-only update (skip apt + rarity smoke test):
#   curl -sL https://raw.githubusercontent.com/LT3NFT/lt3-grid-bot/main/scripts/vm-deploy.sh | SKIP_APT=1 SKIP_RARITY_CHECK=1 bash
set -euo pipefail
export NEEDRESTART_MODE=a
export DEBIAN_FRONTEND=noninteractive

APP="$HOME/lt3-grid-bot"
ZIP_URL="https://github.com/LT3NFT/lt3-grid-bot/archive/refs/heads/main.zip"
SKIP_APT="${SKIP_APT:-0}"
SKIP_RARITY_CHECK="${SKIP_RARITY_CHECK:-0}"

if [ "$SKIP_APT" != "1" ]; then
  need_pkgs=()
  for bin in unzip rsync ffmpeg; do
    command -v "$bin" >/dev/null 2>&1 || need_pkgs+=("$bin")
  done

  echo "==> Installing system packages (Chrome libraries for /rarity)"
  echo "    (stuck here? Ctrl+C and re-run with SKIP_APT=1)"
  sudo apt-get update -qq
  chrome_libs=(libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libxkbcommon0
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 fonts-liberation)
  if [ "${#need_pkgs[@]}" -gt 0 ]; then
    sudo apt-get install -y -qq "${need_pkgs[@]}" >/dev/null
  fi
  sudo apt-get install -y -qq "${chrome_libs[@]}" >/dev/null
  sudo apt-get install -y -qq libasound2t64 >/dev/null 2>&1 || sudo apt-get install -y -qq libasound2 >/dev/null
else
  echo "==> Skipping apt (SKIP_APT=1)"
fi

echo "==> Downloading latest lt3-grid-bot from GitHub"
TMP="$(mktemp -d)"
curl -sL "$ZIP_URL" -o "$TMP/main.zip"
unzip -q "$TMP/main.zip" -d "$TMP"
rsync -a --exclude node_modules --exclude .env --exclude output --exclude .git \
  "$TMP/lt3-grid-bot-main/" "$APP/"
rm -rf "$TMP"

cd "$APP"

touch .env
python3 - <<'PY'
from pathlib import Path
p = Path(".env")
text = p.read_text() if p.exists() else ""
drop = (
    "RARITY_FPS=",
    "RARITY_WIDTH=",
    "RARITY_HEIGHT=",
    "RARITY_TIMEOUT_MS=",
    "TOOLS_REMINDER_INTERVAL_HOURS=",
    "DISCORD_TOOLS_REMINDER_CHANNEL_NAME=",
    "DISCORD_HUDDLE_CHANNEL_NAME=",
)
lines = [ln for ln in text.splitlines() if not ln.startswith(drop)]
lines += [
    "RARITY_WIDTH=1920",
    "RARITY_HEIGHT=1080",
    "RARITY_TIMEOUT_MS=180000",
    "TOOLS_REMINDER_INTERVAL_HOURS=36",
    "DISCORD_TOOLS_REMINDER_CHANNEL_NAME=main-chat",
]
p.write_text("\n".join(lines).rstrip() + "\n")
print("    set RARITY_* + tools reminder → #main-chat every 36h")
PY

echo "==> npm ci"
npm ci --no-audit --no-fund

pkill -f "scripts/check-rarity.js" 2>/dev/null || true
echo "==> VM size: $(nproc) CPU, $(free -m | awk '/Mem:/ {print $2 " MB RAM, " $7 " MB free"}')"

smoke="skipped"
if [ "$SKIP_RARITY_CHECK" = "1" ]; then
  echo "==> Skipping /rarity smoke test (SKIP_RARITY_CHECK=1)"
else
  echo "==> Rendering a test /rarity still"
  if node scripts/check-rarity.js 4449; then
    smoke="ok"
  else
    smoke="failed"
  fi
fi

echo "==> Restarting bot"
pm2 restart lt3-grid-bot --update-env
sleep 8
pm2 logs lt3-grid-bot --lines 40 --nostream | grep -E "Logged in|Slash commands synced|Failed" || true

if [ "$smoke" = "failed" ]; then
  echo "==> /rarity smoke test failed — bot still restarted. Paste logs if Discord /rarity fails."
  exit 1
fi

echo "==> Done. Try /gif wallet:animalvault.eth or /rarity token:4449."
