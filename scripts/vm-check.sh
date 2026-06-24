#!/usr/bin/env bash
# Run on the VM after git pull to verify both bots are healthy.
set -euo pipefail

echo "=== VM memory ==="
free -h
echo ""
swapon --show 2>/dev/null || echo "(no swap — run: bash scripts/vm-harden.sh)"

echo ""
echo "=== lt3-grid-bot version ==="
cd ~/lt3-grid-bot
grep BOT_VERSION src/config.js | head -1

echo ""
echo "=== pm2 ==="
pm2 status

echo ""
echo "=== grid bot env channel lock ==="
grep DISCORD_GRID_CHANNEL_ID .env 2>/dev/null || echo "(not set — works in any channel)"

echo ""
echo "=== grid bot logs ==="
pm2 logs lt3-grid-bot --lines 12 --nostream

echo ""
echo "=== sales bot logs ==="
pm2 logs lt3bot --lines 8 --nostream 2>/dev/null || echo "(lt3bot not running)"
