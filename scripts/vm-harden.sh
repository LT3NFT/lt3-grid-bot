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
npm run register-commands

if pm2 describe lt3-grid-bot >/dev/null 2>&1; then
  pm2 delete lt3-grid-bot
fi
pm2 start ecosystem.config.cjs
pm2 save

echo "=== Restart lt3bot (sales) ==="
if pm2 describe lt3bot >/dev/null 2>&1; then
  sales_dir="$(pm2 jlist 2>/dev/null | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const apps=JSON.parse(d);
        const bot=apps.find(a=>a.name==='lt3bot');
        console.log(bot?.pm2_env?.pm_cwd || '');
      } catch { console.log(''); }
    });
  ")"
  if [[ -n "$sales_dir" && -d "$sales_dir/.git" ]]; then
    (cd "$sales_dir" && git pull) || true
  else
    echo "note: sales bot repo not at ~/lt3bot — skipping git pull (pm2 restart only)"
  fi
  pm2 restart lt3bot --update-env
else
  echo "warning: lt3bot not found in pm2 — start it from your sales bot folder when ready"
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
