import {
  MAX_CONCURRENT_GIF_JOBS,
  MAX_CONCURRENT_GRID_JOBS,
  MAX_TOTAL_HEAVY_JOBS,
} from "../config.js";

function createHeavyQueue() {
  let totalActive = 0;
  let gridActive = 0;
  let gifActive = 0;
  const waiting = [];

  function queueDepth() {
    return waiting.length;
  }

  function canStart(job) {
    if (totalActive >= MAX_TOTAL_HEAVY_JOBS) return false;
    if (job.kind === "grid" && gridActive >= MAX_CONCURRENT_GRID_JOBS) return false;
    if (job.kind === "gif" && gifActive >= MAX_CONCURRENT_GIF_JOBS) return false;
    return true;
  }

  function startNext() {
    for (let i = 0; i < waiting.length; i += 1) {
      const job = waiting[i];
      if (!canStart(job)) continue;

      waiting.splice(i, 1);
      totalActive += 1;
      if (job.kind === "grid") gridActive += 1;
      if (job.kind === "gif") gifActive += 1;
      job.onStart?.();

      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          totalActive -= 1;
          if (job.kind === "grid") gridActive -= 1;
          if (job.kind === "gif") gifActive -= 1;
          startNext();
        });

      return startNext();
    }
  }

  return function enqueue(kind, fn, hooks = {}) {
    return new Promise((resolve, reject) => {
      const ahead = queueDepth() + (canStart({ kind }) ? 0 : 1);
      if (ahead > 0) {
        hooks.onQueued?.(ahead);
      }

      waiting.push({
        kind,
        fn,
        resolve,
        reject,
        onStart: hooks.onStart,
      });
      startNext();
    });
  };
}

const enqueue = createHeavyQueue();

export function runGridJob(fn, hooks = {}) {
  return enqueue("grid", fn, hooks);
}

export function runGifJob(fn, hooks = {}) {
  return enqueue("gif", fn, hooks);
}
