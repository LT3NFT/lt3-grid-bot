/**
 * Serialize /rarity work without parking behind long /gif jobs.
 * One Chrome session at a time; grids/gifs keep using the heavy queue.
 */
let tail = Promise.resolve();
let active = 0;
let waiting = 0;

export function rarityQueueSnapshot() {
  return { active, waiting };
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ onQueued?: (ahead: number) => void, onStart?: () => void }} [hooks]
 * @returns {Promise<T>}
 */
export function runRarityExclusive(fn, hooks = {}) {
  waiting += 1;
  const ahead = active + (waiting - 1);
  if (ahead > 0) hooks.onQueued?.(ahead);

  const run = tail.then(async () => {
    waiting -= 1;
    active += 1;
    hooks.onStart?.();
    try {
      return await fn();
    } finally {
      active -= 1;
    }
  });

  // Keep the chain alive even if this job fails.
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
