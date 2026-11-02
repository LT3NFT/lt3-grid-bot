#!/usr/bin/env bash
# Run ON the VM:
#   curl -sL https://raw.githubusercontent.com/LT3NFT/lt3-grid-bot/main/scripts/vm-deploy.sh | bash
# Pulls latest main into ~/lt3-grid-bot (keeps .env), installs /rarity's Chrome libs, checks /rarity, restarts pm2.
set -euo pipefail

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
echo "==> npm ci (also downloads headless Chrome)"
npm ci --no-audit --no-fund

echo "==> Rendering a test /rarity video"
node scripts/check-rarity.js 4449

echo "==> Restarting bot"
pm2 restart lt3-grid-bot --update-env
sleep 10
pm2 logs lt3-grid-bot --lines 40 --nostream | grep -E "Logged in|Slash commands synced|Failed" || true
echo "==> Done. /rarity should now show up in Discord."
