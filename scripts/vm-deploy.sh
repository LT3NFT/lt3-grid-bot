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
# Prefer the PNG still defaults. Rewrite older video-oriented values from prior deploys.
touch .env
python3 - <<'PY'
from pathlib import Path
p = Path(".env")
text = p.read_text() if p.exists() else ""
lines = [ln for ln in text.splitlines() if not ln.startswith(("RARITY_FPS=", "RARITY_WIDTH=", "RARITY_HEIGHT=", "RARITY_TIMEOUT_MS="))]
lines += [
    "RARITY_WIDTH=1920",
    "RARITY_HEIGHT=1080",
    "RARITY_TIMEOUT_MS=180000",
]
p.write_text("\n".join(lines).rstrip() + "\n")
print("    set RARITY_WIDTH=1920 RARITY_HEIGHT=1080 RARITY_TIMEOUT_MS=180000")
PY

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
