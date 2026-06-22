const userLastUse = new Map();

export function checkCooldown(userId, cooldownMs, command = "default") {
  const key = `${command}:${userId}`;
  const now = Date.now();
  const last = userLastUse.get(key) || 0;
  const remaining = cooldownMs - (now - last);
  if (remaining > 0) {
    return { ok: false, remainingSeconds: Math.ceil(remaining / 1000) };
  }
  userLastUse.set(key, now);
  return { ok: true };
}
