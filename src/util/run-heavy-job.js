import { fork } from "child_process";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), "heavy-job-worker.js");

/**
 * Run a heavy build in a child process so sharp/ffmpeg/puppeteer cannot block Discord ACKs.
 * @param {"gif"|"grid"|"rarity"|"random"|"randomgrid"} type
 * @param {object} payload
 * @param {{ timeoutMs?: number, onProgress?: (stage: string|object) => void }} [opts]
 */
export function runHeavyJob(type, payload, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 600_000;
  const onProgress = opts.onProgress;

  return new Promise((resolve, reject) => {
    const child = fork(WORKER, [], {
      env: process.env,
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });

    let settled = false;
    const timer = setTimeout(() => {
      finish(new Error("That request took too long — try again in a moment."));
      child.kill("SIGKILL");
    }, timeoutMs);

    async function finish(err, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited
      }
      if (err) {
        reject(err);
        return;
      }
      try {
        const buffer = await readFile(result.outPath);
        await unlink(result.outPath).catch(() => {});
        const { outPath: _p, bytes: _b, ...meta } = result;
        resolve({ ...meta, buffer });
      } catch (readErr) {
        reject(readErr);
      }
    }

    child.on("message", (msg) => {
      if (msg?.type === "progress") {
        onProgress?.(msg.stage);
        return;
      }
      if (msg?.type === "result") {
        void finish(null, msg.result);
        return;
      }
      if (msg?.type === "error") {
        void finish(new Error(msg.error || "Heavy job failed"));
      }
    });

    child.on("error", (err) => {
      void finish(err);
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      void finish(
        new Error(
          signal
            ? `Job process stopped (${signal}). Try again.`
            : `Job process exited (${code}). Try again.`
        )
      );
    });

    child.send({ type, payload });
  });
}
