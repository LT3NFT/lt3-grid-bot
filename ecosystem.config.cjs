/**
 * PM2 process file — run from the project root:
 *   pm2 start ecosystem.config.cjs
 * Keeps memory bounded so the sales bot (lt3bot) on the same VM stays alive.
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "lt3-grid-bot",
      cwd: __dirname,
      script: "src/index.js",
      interpreter: "node",
      node_args: "--max-old-space-size=384",
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      min_uptime: "10s",
      exp_backoff_restart_delay: 3000,
      max_memory_restart: "420M",
      env: {
        SHARP_CONCURRENCY: "2",
        MAX_CONCURRENT_GRID_JOBS: "2",
        MAX_CONCURRENT_GIF_JOBS: "1",
        MAX_TOTAL_HEAVY_JOBS: "2",
      },
      error_file: path.join(__dirname, "logs", "pm2-error.log"),
      out_file: path.join(__dirname, "logs", "pm2-out.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
