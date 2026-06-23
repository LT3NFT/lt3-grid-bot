import { MAX_CONCURRENT_HEAVY_JOBS } from "../config.js";

function createJobPool(maxConcurrent) {
  let active = 0;
  const waiting = [];

  function startNext() {
    if (active >= maxConcurrent || waiting.length === 0) return;

    active += 1;
    const { fn, resolve, reject, onStart } = waiting.shift();
    onStart?.();

    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        startNext();
      });
  }

  return function runJob(fn, hooks = {}) {
    return new Promise((resolve, reject) => {
      const queuedAhead = waiting.length;
      if (queuedAhead > 0) {
        hooks.onQueued?.(queuedAhead);
      }

      waiting.push({ fn, resolve, reject, onStart: hooks.onStart });
      startNext();
    });
  };
}

/** Shared pool for all /grid and /gif jobs — avoids OOM from too many parallel heavy tasks. */
export const runHeavyJob = createJobPool(MAX_CONCURRENT_HEAVY_JOBS);
