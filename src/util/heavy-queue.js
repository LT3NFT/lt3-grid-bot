import {
  MAX_CONCURRENT_GIF_JOBS,
  MAX_CONCURRENT_GRID_JOBS,
} from "../config.js";

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
      const queuedAhead = waiting.length + (active >= maxConcurrent ? 1 : 0);
      if (queuedAhead > 0) {
        hooks.onQueued?.(queuedAhead);
      }

      waiting.push({ fn, resolve, reject, onStart: hooks.onStart });
      startNext();
    });
  };
}

const gridPool = createJobPool(MAX_CONCURRENT_GRID_JOBS);
const gifPool = createJobPool(MAX_CONCURRENT_GIF_JOBS);

let gifJobsRunning = 0;
const gifWaiters = [];

export function isGifRunning() {
  return gifJobsRunning > 0;
}

function notifyGifWaiters() {
  if (gifJobsRunning > 0) return;
  const waiters = gifWaiters.splice(0);
  for (const resume of waiters) resume();
}

function waitUntilNoGif() {
  if (gifJobsRunning === 0) return Promise.resolve();
  return new Promise((resolve) => {
    gifWaiters.push(resolve);
  });
}

/** GIF gets exclusive VM time — grids wait so nothing crashes or freezes. */
export function runGifJob(fn, hooks = {}) {
  return gifPool(async () => {
    gifJobsRunning += 1;
    try {
      return await fn();
    } finally {
      gifJobsRunning -= 1;
      notifyGifWaiters();
    }
  }, hooks);
}

/** Up to N grids in parallel, but never while a GIF is encoding. */
export function runGridJob(fn, hooks = {}) {
  return new Promise((resolve, reject) => {
    const start = async () => {
      if (gifJobsRunning > 0) {
        hooks.onQueued?.(1);
        await waitUntilNoGif();
      }
      try {
        const result = await gridPool(fn, hooks);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    start();
  });
}
