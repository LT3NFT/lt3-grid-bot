#!/usr/bin/env bash
# Run ON the GCP VM (browser SSH). Adds swap, deploys grid bot with PM2 limits,
# and restarts the sales bot so both survive memory spikes.
set -euo pipefail

echo "=== VM memory (before) ==="
free -h

if ! swapon --show 2>/dev/null | grep -q '/swapfile'; then
  echo "=== Adding 2G swap (prevents OOM freezes) ==="
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
else
  echo "=== Swap already enabled ==="
fi

echo "=== Deploy lt3-grid-bot ==="
cd ~/lt3-grid-bot
git pull
npm ci
mkdir -p logs

if pm2 describe lt3-grid-bot >/dev/null 2>&1; then
  pm2 delete lt3-grid-bot
fi
pm2 start ecosystem.config.cjs
pm2 save

echo "=== Restart lt3bot (sales) ==="
if pm2 describe lt3bot >/dev/null 2>&1; then
  cd ~/lt3bot
  git pull || true
  pm2 restart lt3bot --update-env
else
  echo "warning: lt3bot not found in pm2 — start it from ~/lt3bot when ready"
fi

pm2 save

echo ""
echo "=== PM2 status ==="
pm2 status

echo ""
echo "=== VM memory (after) ==="
free -h

echo ""
echo "=== Grid bot logs ==="
pm2 logs lt3-grid-bot --lines 8 --nostream

echo ""
echo "If you have not run 'pm2 startup' on this VM before:"
echo "  pm2 startup"
echo "  (paste the sudo line it prints)"
echo "  pm2 save"
