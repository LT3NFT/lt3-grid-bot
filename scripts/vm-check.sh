#!/bin/bash
# Run on the VM after git pull to verify the bot is healthy.
set -e
cd ~/lt3-grid-bot

echo "=== version ==="
grep BOT_VERSION src/config.js | head -1

echo "=== pm2 ==="
pm2 status

echo "=== env channel lock ==="
grep DISCORD_GRID_CHANNEL_ID .env || echo "(not set — works in any channel)"

echo "=== recent logs ==="
pm2 logs lt3-grid-bot --lines 15 --nostream
