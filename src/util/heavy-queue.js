let tail = Promise.resolve();

/** Run one grid/gif job at a time so heavy work does not block new interactions. */
export function runHeavyJob(fn) {
  const job = tail.then(() => fn());
  tail = job.catch(() => {});
  return job;
}
