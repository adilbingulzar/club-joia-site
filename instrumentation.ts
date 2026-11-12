/*
 * Runs once when the server starts. IFZA sends no payment notification, so every few minutes the
 * shop asks IFZA about orders whose card was sent and that aren't decided yet (lib/shop/orders.ts
 * sweep): a buyer who paid and closed the page before coming back still gets the tickets.
 */
const EVERY_MS = 3 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const g = globalThis as unknown as { __cjSweep?: ReturnType<typeof setInterval> };
  if (g.__cjSweep) return;
  const { sweep } = await import('./lib/shop/orders');
  const { configured } = await import('./lib/shop/ifza');
  let running = false;
  g.__cjSweep = setInterval(function () {
    if (running || !configured()) return;
    running = true;
    sweep()
      .then(function (n) { if (n) console.info('[shop] sweep: asked IFZA about ' + n + ' order(s)'); })
      .catch(function (e) { console.error('[shop] sweep:', (e as Error).message); })
      .finally(function () { running = false; });
  }, EVERY_MS);
  g.__cjSweep.unref?.();
}
