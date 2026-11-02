#!/usr/bin/env bash
# Run ON the VM:
#   curl -sL https://raw.githubusercontent.com/LT3NFT/lt3-grid-bot/main/scripts/vm-deploy.sh | bash
# Pulls latest main into ~/lt3-grid-bot (keeps .env), installs /rarity's Chrome libs, checks /rarity, restarts pm2.
set -euo pipefail
export NEEDRESTART_MODE=a
export DEBIAN_FRONTEND=noninteractive

APP="$HOME/lt3-grid-bot"
ZIP_URL="https://github.com/LT3NFT/lt3-grid-bot/archive/refs/heads/main.zip"

need_pkgs=()
for bin in unzip rsync ffmpeg; do
  command -v "$bin" >/dev/null 2>&1 || need_pkgs+=("$bin")
done

echo "==> Installing system packages (Chrome libraries for /rarity)"
sudo apt-get update -qq
chrome_libs=(libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libxkbcommon0
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 fonts-liberation)
sudo apt-get install -y -qq "${need_pkgs[@]}" "${chrome_libs[@]}" >/dev/null
sudo apt-get install -y -qq libasound2t64 >/dev/null 2>&1 || sudo apt-get install -y -qq libasound2 >/dev/null

echo "==> Downloading latest lt3-grid-bot from GitHub"
TMP="$(mktemp -d)"
curl -sL "$ZIP_URL" -o "$TMP/main.zip"
unzip -q "$TMP/main.zip" -d "$TMP"
rsync -a --exclude node_modules --exclude .env --exclude output --exclude .git \
  "$TMP/lt3-grid-bot-main/" "$APP/"
rm -rf "$TMP"

cd "$APP"

# Keep Discord wait windows happy on small VMs (override anytime in .env).
touch .env
for line in \
  'RARITY_FPS=20' \
  'RARITY_WIDTH=1280' \
  'RARITY_HEIGHT=720' \
  'RARITY_TIMEOUT_MS=600000'
do
  key="${line%%=*}"
  if ! grep -q "^${key}=" .env; then
    echo "$line" >> .env
    echo "    added $line to .env"
  fi
done

echo "==> npm ci (also downloads headless Chrome)"
npm ci --no-audit --no-fund

pkill -f "scripts/check-rarity.js" 2>/dev/null || true
echo "==> VM size: $(nproc) CPU, $(free -m | awk '/Mem:/ {print $2 " MB RAM, " $7 " MB free"}')"
echo "==> Rendering a test /rarity video (don't run /rarity in Discord until this finishes)"
if node scripts/check-rarity.js 4449; then
  smoke="ok"
else
  smoke="failed"
fi

echo "==> Restarting bot"
pm2 restart lt3-grid-bot --update-env
sleep 8
pm2 logs lt3-grid-bot --lines 40 --nostream | grep -E "Logged in|Slash commands synced|Failed" || true

if [ "$smoke" = "ok" ]; then
  echo "==> Done. Try /rarity token:4449 in Discord."
else
  echo "==> Test render failed — copy everything above and send it over."
  exit 1
fi
